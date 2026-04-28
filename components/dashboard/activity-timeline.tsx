"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/utils";
import { toast } from "sonner";
import { Send, AlertCircle, AlertTriangle, Clock, CheckCircle2, FileText, TrendingUp } from "lucide-react";

interface ReminderGroup {
  request_id: string;
  client_name: string;
  amount: number;
  due_date: string;
  reminder_type: string;
  already_sent: boolean;
}

interface ScheduledSend {
  id: string;
  total_clients: number;
  total_amount: number;
  scheduled_at: string;
}

interface TodayData {
  today: string;
  summary: {
    totalReminders: number;
    pendingReminders: number;
    scheduledSends: number;
  };
  reminders: {
    one_day_before: ReminderGroup[];
    due_today: ReminderGroup[];
    one_day_overdue: ReminderGroup[];
    three_days_overdue: ReminderGroup[];
    seven_days_overdue: ReminderGroup[];
  };
  scheduledSends: ScheduledSend[];
}

interface WeekDayActivity {
  date: string;
  scheduledSends: Array<{ id: string; scheduled_at: string; total_clients: number; total_amount: number; description: string }>;
  dueRequests: Array<{ id: string; due_date: string; total_due: number; outstanding: number; status: string; clients: { name: string } | null; notification_channels: string }>;
  payments: Array<{ id: string; amount: number; payment_date: string; clients: { name: string } | null }>;
}

export function ActivityTimeline({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [weekData, setWeekData] = useState<WeekDayActivity[]>([]);

  // Day-of-week in SAST: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const dayOfWeek = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" })).getDay();
  const isMonday = dayOfWeek === 1;
  const isFriday = dayOfWeek === 5;
  const isMidWeek = dayOfWeek >= 2 && dayOfWeek <= 4;
  const weekMode = isFriday ? "summary" : isMidWeek ? "today" : "upcoming";

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      const [todayRes, weekRes] = await Promise.all([
        fetch("/api/activity/today"),
        fetch(`/api/activity/week?mode=${weekMode}`),
      ]);

      const today = await todayRes.json();
      const week = await weekRes.json();

      if (today.success) setTodayData(today);
      if (week.success) setWeekData(week.weekActivity);
    } catch (error) {
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!todayData) {
    return <div className="text-center text-muted-foreground py-8">No activity data available</div>;
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getReminderLabel = (type: string) => {
    switch (type) {
      case "one_day_before": return "1 Day Before Due";
      case "due_today": return "Due Today";
      case "one_day_overdue": return "1 Day Overdue";
      case "three_days_overdue": return "3 Days Overdue";
      case "seven_days_overdue": return "7 Days Overdue";
      default: return type;
    }
  };

  const getReminderColor = (type: string) => {
    switch (type) {
      case "one_day_before": return "text-blue-600 bg-blue-50 border-blue-200";
      case "due_today": return "text-amber-600 bg-amber-50 border-amber-200";
      case "one_day_overdue": return "text-orange-600 bg-orange-50 border-orange-200";
      case "three_days_overdue": return "text-red-600 bg-red-50 border-red-200";
      case "seven_days_overdue": return "text-red-700 bg-red-100 border-red-300";
      default: return "text-muted-foreground bg-muted/30 border-border";
    }
  };

  const allReminders = Object.values(todayData.reminders ?? {}).flat() as ReminderGroup[];
  const pendingReminders = allReminders.filter(r => !r.already_sent);
  const sentReminders    = allReminders.filter(r => r.already_sent);
  const nothingToday = allReminders.length === 0 && (todayData.scheduledSends ?? []).length === 0;

  return (
    <div className="space-y-4">

      {/* ── Action needed today ─────────────────────────────────────────── */}
      <div>
        {nothingToday ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-emerald-700">Nothing urgent today</p>
            <p className="text-xs text-muted-foreground mt-0.5">All caught up</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Scheduled sends */}
            {(todayData.scheduledSends ?? []).map(send => (
              <div key={send.id} className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-sky-800 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-sky-500" /> Sending now</p>
                  <p className="text-xs text-sky-600">{send.total_clients} clients · {formatTime(send.scheduled_at)}</p>
                </div>
                <p className="text-sm font-bold text-sky-700">R{send.total_amount.toLocaleString()}</p>
              </div>
            ))}

            {/* Pending reminders */}
            {pendingReminders.map(r => (
              <div key={r.request_id} className={`rounded-lg px-3 py-2.5 border ${getReminderColor(r.reminder_type)} flex items-center justify-between`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.client_name}</p>
                  <p className="text-xs mt-0.5">{getReminderLabel(r.reminder_type)} · due {fmtDate(r.due_date)}</p>
                </div>
                <p className="text-sm font-bold ml-2 shrink-0">R{r.amount.toLocaleString()}</p>
              </div>
            ))}

            {/* Already sent today */}
            {sentReminders.length > 0 && (
              <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Already sent today</p>
                {sentReminders.map(r => (
                  <div key={r.request_id} className="flex items-center justify-between py-1">
                    <p className="text-xs font-medium truncate">{r.client_name}</p>
                    <p className="text-xs font-bold ml-2 shrink-0">R{r.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── This week ──────────────────────────────────────────────────── */}
      {weekData.length > 0 && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {isFriday ? "This week's summary" : isMonday ? "Coming up this week" : "This week"}
          </p>

          {weekData.map(day => {
            const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
            const isToday  = day.date === todayStr;
            const isPast   = day.date < todayStr;
            const dueReqs  = (day.dueRequests ?? []) as any[];
            const payments = (day.payments   ?? []) as any[];
            const sends    = (day.scheduledSends ?? []) as any[];
            if (!isToday && dueReqs.length === 0 && payments.length === 0 && sends.length === 0) return null;

            return (
              <div key={day.date} className={`rounded-lg px-3 py-2.5 ${
                isToday ? "bg-primary/5 ring-1 ring-primary/20" :
                isPast  ? "bg-muted/20" : "bg-muted/10"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold">
                    {isToday ? "Today" : formatDate(day.date)}
                  </p>
                  {payments.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      +R{payments.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString()} received
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {sends.map((s: any) => (
                    <p key={s.id} className="text-xs text-sky-700 flex items-center gap-1.5"><Send className="w-3 h-3 shrink-0 text-sky-500" /> Sending to {s.total_clients} clients</p>
                  ))}
                  {dueReqs.map((r: any) => {
                    const client = r.clients as { name: string } | null;
                    const isOverdue = r.status === "overdue";
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate flex items-center gap-1.5 ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          {isOverdue
                            ? <AlertCircle className="w-3 h-3 shrink-0 text-red-500" />
                            : <FileText className="w-3 h-3 shrink-0 text-slate-400" />}
                          {client?.name ?? "Unknown"}{isOverdue ? " — overdue" : ""}
                        </p>
                        <p className="text-xs font-bold shrink-0">R{Number(r.outstanding).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isFriday && (() => {
            const totalPaid    = weekData.flatMap((d: WeekDayActivity) => d.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
            const overdueCount = weekData.flatMap((d: WeekDayActivity) => d.dueRequests ?? []).filter((r: any) => r.status === "overdue").length;
            return totalPaid > 0 || overdueCount > 0 ? (
              <div className="flex gap-3 pt-1">
                {totalPaid > 0 && (
                  <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-sm font-bold text-emerald-700">R{totalPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600">collected this week</p>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="flex-1 bg-red-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-sm font-bold text-red-700">{overdueCount}</p>
                    <p className="text-[10px] text-red-600">still overdue</p>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
