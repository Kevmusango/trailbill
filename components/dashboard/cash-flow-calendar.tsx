"use client";

import { useState, useMemo } from "react";
import { fmtDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrendingUp, Banknote, FileText, Bell, Send, Clock, AlertTriangle, CalendarCheck } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface PaymentRequest {
  id: string;
  clientName: string;
  amount: number;
  outstanding: number;
  dueDate: string;       // YYYY-MM-DD
  committedDate: string | null;
  scheduledAt: string | null;
  sentAt: string | null; // when batch actually fired
  status: string;
  description?: string | null;
}

interface ReceivedPayment {
  id: string;
  clientName: string;
  amount: number;
  paidAt: string;        // YYYY-MM-DD
}

interface SentReminder {
  id: string;
  clientName: string;
  amount: number;
  sentAt: string;        // ISO timestamp
  reminderType: string;
  channel: string;
  description?: string | null;
}

interface GroupContract {
  id: string;
  name: string;
  defaultAmount: number;
  dueDay: number;
  activeMonths: number[]; // 1-12
  isActive: boolean;
}

interface ProposalStart {
  id: string;
  clientName: string;
  proposalTitle: string;
  amount: number;
  startDate: string;      // YYYY-MM-DD
  startMonthOnly: boolean;
}

interface CashFlowCalendarProps {
  events: PaymentRequest[];
  receivedPayments?: ReceivedPayment[];
  sentReminders?: SentReminder[];
  groups?: GroupContract[];
  proposalStarts?: ProposalStart[];
}

// ── Per-day computed data ─────────────────────────────────────────────────

interface DayData {
  requests: PaymentRequest[];
  received: ReceivedPayment[];
  reminders: SentReminder[];
  scheduledSends: PaymentRequest[];
  sentRequests: PaymentRequest[];   // requests that were actually sent on this day
  upcomingReminders: { clientName: string; amount: number; label: string; description?: string | null }[]; // planned pre-due reminders (certain)
  followUps: { clientName: string; amount: number; label: string; description?: string | null }[];         // potential follow-ups if unpaid
  projectStarts: ProposalStart[];
  totalDue: number;
  totalReceived: number;
  scheduledCount: number;
  reminderCount: number;
  upcomingReminderCount: number;
  followUpCount: number;
  projectStartCount: number;
  overdueCount: number;
  isPast: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toSASTDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}
function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDayOfMonth(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `R${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000)     return `R${(n / 1_000).toFixed(1)}k`;
  return `R${n.toLocaleString()}`;
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const REMINDER_OFFSETS: { days: number; label: string }[] = [
  { days: -1, label: "1 day before due" },
  { days:  0, label: "Due date reminder" },
];

const FOLLOWUP_OFFSETS: { days: number; label: string }[] = [
  { days:  1, label: "1 day overdue" },
  { days:  3, label: "3 days overdue" },
  { days:  7, label: "7 days overdue" },
];

const REMINDER_LABELS: Record<string, string> = {
  "1_day_before": "1 day before",
  "due_date":     "Due date",
  "1_day_after":  "1 day after",
  "3_days_after": "3 days after",
  "7_days_after": "7 days after",
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── Component ───────────────────────────────────────────────────────────────

export function CashFlowCalendar({
  events = [],
  receivedPayments = [],
  sentReminders = [],
  groups = [],
  proposalStarts = [],
}: CashFlowCalendarProps) {
  const today    = new Date();
  const todayStr = today.toLocaleDateString("en-CA");

  const [year,        setYear       ] = useState(today.getFullYear());
  const [month,       setMonth      ] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const thisMonth   = month + 1; // 1-12 for group matching

  // ── Build per-day data map ────────────────────────────────────────────
  const dayMap = useMemo<Record<number, DayData>>(() => {
    const map: Record<number, DayData> = {};

    const getDay = (d: number): DayData => {
      if (!map[d]) {
        const dt = new Date(year, month, d);
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        map[d] = {
          requests: [], received: [], reminders: [], scheduledSends: [], sentRequests: [], upcomingReminders: [], followUps: [], projectStarts: [],
          totalDue: 0, totalReceived: 0, scheduledCount: 0, reminderCount: 0, upcomingReminderCount: 0, followUpCount: 0, projectStartCount: 0,
          overdueCount: 0, isPast: dt < todayMidnight,
        };
      }
      return map[d];
    };

    // 1. Payment requests
    events.forEach(ev => {
      // Scheduled send: place on scheduled_at date (future/pending)
      if (ev.scheduledAt && ev.status === "scheduled") {
        const d = parseDate(toSASTDateStr(ev.scheduledAt));
        if (d.getFullYear() === year && d.getMonth() === month) {
          const slot = getDay(d.getDate());
          slot.scheduledSends.push(ev);
          slot.scheduledCount++;
        }
      }

      // Actually sent: place on sent_at date (historical record)
      if (ev.sentAt && ev.status !== "scheduled") {
        const d = parseDate(toSASTDateStr(ev.sentAt));
        if (d.getFullYear() === year && d.getMonth() === month) {
          const slot = getDay(d.getDate());
          slot.sentRequests.push(ev);
        }
      }

      // Place on effective date (committed or due)
      const effectiveDateStr = ev.committedDate ?? ev.dueDate;
      const ed = parseDate(effectiveDateStr);
      if (ed.getFullYear() === year && ed.getMonth() === month) {
        const slot = getDay(ed.getDate());
        slot.requests.push(ev);
        if (ev.status === "overdue") {
          slot.overdueCount++;
          slot.totalDue += ev.outstanding;
        } else if (ev.status !== "paid" && ev.status !== "partial") {
          slot.totalDue += ev.outstanding;
        }
      }
    });

    // 2. Received payments
    receivedPayments.forEach(p => {
      const d = parseDate(p.paidAt.split("T")[0]);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const slot = getDay(d.getDate());
        slot.received.push(p);
        slot.totalReceived += p.amount;
      }
    });

    // 3. Upcoming reminders (pre-due, certain to fire) + potential follow-ups (post-due, if unpaid)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    events.forEach(ev => {
      if (ev.status === "paid") return;
      const effective = parseDate(ev.committedDate ?? ev.dueDate);

      REMINDER_OFFSETS.forEach(({ days, label }) => {
        const fd = addDays(effective, days);
        if (fd >= todayStart && fd.getFullYear() === year && fd.getMonth() === month) {
          const slot = getDay(fd.getDate());
          slot.upcomingReminders.push({ clientName: ev.clientName, amount: ev.outstanding, label, description: ev.description });
          slot.upcomingReminderCount++;
        }
      });

      FOLLOWUP_OFFSETS.forEach(({ days, label }) => {
        const fd = addDays(effective, days);
        if (fd >= todayStart && fd.getFullYear() === year && fd.getMonth() === month) {
          const slot = getDay(fd.getDate());
          slot.followUps.push({ clientName: ev.clientName, amount: ev.outstanding, label, description: ev.description });
          slot.followUpCount++;
        }
      });
    });

    // 4. Sent reminders (actual historical record)
    sentReminders.forEach(r => {
      const d = parseDate(toSASTDateStr(r.sentAt));
      if (d.getFullYear() === year && d.getMonth() === month) {
        const slot = getDay(d.getDate());
        slot.reminders.push(r);
        slot.reminderCount++;
      }
    });

    // 5. Accepted proposal project starts
    proposalStarts.forEach(ps => {
      const d = parseDate(ps.startDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const slot = getDay(d.getDate());
        slot.projectStarts.push(ps);
        slot.projectStartCount++;
      }
    });

    return map;
  }, [events, receivedPayments, sentReminders, proposalStarts, year, month]);

  const upcomingRemindersForSelectedDay = selectedDay ? (dayMap[selectedDay]?.upcomingReminders ?? []) : [];
  const followUpsForSelectedDay          = selectedDay ? (dayMap[selectedDay]?.followUps          ?? []) : [];

  // ── Month summary ──────────────────────────────────────────────────
  const summary = useMemo(() => {
    const monthReqs = events.filter(ev => {
      const d = parseDate(ev.committedDate ?? ev.dueDate);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const expected  = monthReqs.reduce((s, e) => s + e.amount, 0);
    const collected = receivedPayments
      .filter(p => { const d = parseDate(p.paidAt.split("T")[0]); return d.getFullYear() === year && d.getMonth() === month; })
      .reduce((s, p) => s + p.amount, 0);
    const overdueReqs  = monthReqs.filter(e => e.status === "overdue");
    const overdue      = overdueReqs.reduce((s, e) => s + e.outstanding, 0);
    const overdueCount = overdueReqs.length;
    const rate         = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { expected, collected, overdue, overdueCount, outstanding: Math.max(0, expected - collected), rate, count: monthReqs.length };
  }, [events, receivedPayments, year, month]);

  // ── Group contracts for this month ─────────────────────────────────
  const activeGroups   = groups.filter(g => g.isActive && g.activeMonths.includes(thisMonth));
  const inactiveGroups = groups.filter(g => g.isActive && !g.activeMonths.includes(thisMonth));

  // ── Navigation ─────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const selectedData = selectedDay ? dayMap[selectedDay] : null;
  const hasAnything = selectedData
    ? (selectedData.requests.length + selectedData.received.length + selectedData.reminders.length +
       selectedData.scheduledSends.length + selectedData.sentRequests.length +
       selectedData.upcomingReminders.length + selectedData.followUps.length +
       selectedData.projectStarts.length) > 0
    : false;

  const pct = summary.expected > 0 ? Math.min(100, Math.round((summary.collected / summary.expected) * 100)) : 0;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Health banner ───────────────────────────────────────────────── */}
      {isCurrentMonth && (
        summary.overdueCount > 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-700">
                {summary.overdueCount} client{summary.overdueCount > 1 ? "s are" : " is"} overdue
              </p>
              <p className="text-xs text-red-600">{fmtMoney(summary.overdue)} still needs to be paid — tap a red day to see who</p>
            </div>
          </div>
        ) : summary.count > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">✅</span>
            <p className="text-sm font-semibold text-emerald-700">Everything is on track for {MONTH_NAMES[month]}</p>
          </div>
        ) : null
      )}

      {/* ── Main calendar card ──────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-3">

        {/* Nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <span className="text-base font-bold pointer-events-none select-none px-1">
                {MONTH_NAMES[month]} {year}
              </span>
              <input
                type="month"
                value={`${year}-${String(month + 1).padStart(2, "0")}`}
                onChange={e => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  if (!isNaN(y) && !isNaN(m)) { setYear(y); setMonth(m - 1); setSelectedDay(null); }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
            {!isCurrentMonth && (
              <button
                onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null); }}
                className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
              >
                Today
              </button>
            )}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {summary.expected > 0 && (
          <div className="mb-3 px-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-emerald-700">Collected {fmtMoney(summary.collected)}</span>
              <span className="text-muted-foreground">of {fmtMoney(summary.expected)} expected</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 text-right">{pct}% collected</p>
          </div>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="h-16" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day     = i + 1;
            const data    = dayMap[day];
            const dateStr = new Date(year, month, day).toLocaleDateString("en-CA");
            const isToday = dateStr === todayStr;
            const isSel   = day === selectedDay;
            const isOverdue = (data?.overdueCount ?? 0) > 0;
            const isUnpaidPast = !isOverdue && (data?.isPast ?? false) && (data?.totalDue ?? 0) > 0;
            const hasReceived  = (data?.totalReceived ?? 0) > 0;
            const hasFutureDue = !data?.isPast && (data?.totalDue ?? 0) > 0;
            const hasReminder  = (data?.reminderCount ?? 0) > 0 || (data?.upcomingReminderCount ?? 0) > 0;

            const bgClass = isSel
              ? "bg-primary ring-2 ring-primary"
              : isToday
                ? "ring-2 ring-primary bg-primary/5"
                : isOverdue
                  ? "bg-red-100 hover:bg-red-200"
                  : isUnpaidPast
                    ? "bg-amber-50 hover:bg-amber-100"
                    : hasReceived
                      ? "bg-emerald-50 hover:bg-emerald-100"
                      : hasFutureDue
                        ? "bg-sky-50 hover:bg-sky-100"
                        : "hover:bg-muted/50";

            const amountText = hasReceived
              ? `+${fmtMoney(data!.totalReceived)}`
              : (data?.totalDue ?? 0) > 0
                ? fmtMoney(data!.totalDue)
                : null;

            const amountCls = isSel
              ? "text-primary-foreground"
              : hasReceived
                ? "text-emerald-700"
                : isOverdue
                  ? "text-red-700"
                  : isUnpaidPast
                    ? "text-amber-700"
                    : "text-sky-700";

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`h-16 rounded-lg flex flex-col items-center justify-between py-1.5 px-0.5 overflow-hidden transition-all cursor-pointer ${bgClass}`}
              >
                <span className={`text-xs font-bold leading-none ${
                  isSel ? "text-primary-foreground" :
                  isToday ? "text-primary" :
                  isOverdue ? "text-red-700" :
                  !data ? "text-muted-foreground/30" : ""
                }`}>{day}</span>

                {!isSel && amountText && (
                  <span className={`text-[10px] font-bold leading-none truncate w-full text-center ${amountCls}`}>
                    {amountText}
                  </span>
                )}

                <div className="h-1.5 flex gap-0.5 items-center justify-center">
                  {!isSel && isOverdue    && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                  {!isSel && hasReminder  && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                  {!isSel && (data?.followUpCount ?? 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                  {!isSel && (data?.projectStartCount ?? 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Compact colour key */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />Overdue</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" />Unpaid past</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-3 rounded bg-sky-50 border border-sky-300 inline-block" />Expected</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-block" />Paid</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />Project starts</span>
        </div>
      </div>

      {/* ── Selected day detail ─────────────────────────────────────────── */}
      {selectedDay && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h4 className="font-bold border-b border-border pb-2">
            {new Date(year, month, selectedDay).toLocaleDateString("en-ZA", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </h4>

          {/* Money received */}
          {(selectedData?.received.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Money received</p>
              <div className="space-y-1.5">
                {selectedData!.received.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2.5">
                    <span className="text-sm font-medium">{p.clientName}</span>
                    <span className="text-sm font-bold text-emerald-700">+{fmtMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment requests on this day */}
          {(selectedData?.requests.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Payments due</p>
              <div className="space-y-1.5">
                {selectedData!.requests.map(ev => {
                  const statusLabel: Record<string, string> = {
                    paid: "✅ Paid", partial: "⚠️ Part paid", overdue: "🔴 Overdue",
                    committed: "🤝 Committed", sent: "📧 Sent", opened: "👀 Opened", scheduled: "🕐 Scheduled",
                  };
                  return (
                    <div key={ev.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      ev.status === "overdue" ? "bg-red-50" :
                      ev.status === "paid"    ? "bg-emerald-50" :
                      ev.status === "committed" ? "bg-sky-50" : "bg-muted/30"
                    }`}>
                      <div className="min-w-0">
                        <span className="text-sm font-medium block truncate">{ev.clientName}</span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabel[ev.status] ?? ev.status}
                          {ev.committedDate && ev.committedDate !== ev.dueDate && ` · originally due ${fmtDate(ev.dueDate)}`}
                        </span>
                      </div>
                      <span className="text-sm font-bold ml-2 shrink-0">{fmtMoney(ev.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reminders sent */}
          {(selectedData?.reminders.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Reminders sent</p>
              <div className="space-y-1.5">
                {selectedData!.reminders.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{r.clientName}</span>
                      <span className="text-xs text-indigo-600">{REMINDER_LABELS[r.reminderType] ?? r.reminderType} · via {r.channel}</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-700 ml-2 shrink-0">{fmtMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests sent on this day */}
          {(selectedData?.sentRequests.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Requests sent</p>
              <div className="space-y-1.5">
                {selectedData!.sentRequests.map(ev => (
                  <div key={`sr-${ev.id}`} className="flex items-center justify-between bg-sky-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{ev.clientName}</span>
                      <span className="text-xs text-sky-600">Due {fmtDate(ev.dueDate)}</span>
                    </div>
                    <span className="text-sm font-bold text-sky-700 ml-2 shrink-0">{fmtMoney(ev.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming reminders */}
          {upcomingRemindersForSelectedDay.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Reminders going out soon</p>
              <div className="space-y-1.5">
                {upcomingRemindersForSelectedDay.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{r.clientName}</span>
                      <span className="text-xs text-violet-600">{r.label}</span>
                    </div>
                    <span className="text-sm font-bold text-violet-700 ml-2 shrink-0">{fmtMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {followUpsForSelectedDay.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Consider following up</p>
              <div className="space-y-1.5">
                {followUpsForSelectedDay.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{f.clientName}</span>
                      <span className="text-xs text-amber-600">{f.label}</span>
                    </div>
                    <span className="text-sm font-bold text-amber-700 ml-2 shrink-0">{fmtMoney(f.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project starts */}
          {(selectedData?.projectStarts.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" /> Project starts</p>
              <div className="space-y-1.5">
                {selectedData!.projectStarts.map(ps => (
                  <div key={ps.id} className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{ps.clientName}</span>
                      <span className="text-xs text-teal-600">{ps.proposalTitle}{ps.startMonthOnly ? " · start of month" : ""}</span>
                    </div>
                    <span className="text-sm font-bold text-teal-700 ml-2 shrink-0">{fmtMoney(ps.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAnything && (
            <p className="text-sm text-muted-foreground text-center py-4">Nothing happening on this day</p>
          )}
        </div>
      )}

      {/* ── Active group contracts ───────────────────────────────────────── */}
      {activeGroups.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Active groups this month
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeGroups.map(g => (
              <div key={g.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{g.name}</span>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold text-primary">{fmtMoney(g.defaultAmount)}/member</p>
                  <p className="text-[11px] text-muted-foreground">Due {g.dueDay}{ordinal(g.dueDay)}</p>
                </div>
              </div>
            ))}
          </div>
          {inactiveGroups.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Not active this month: {inactiveGroups.map(g => g.name).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
