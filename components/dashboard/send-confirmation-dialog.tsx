"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Send, Clock, Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  mode: "individual" | "group" | "batch";
  requestCount: number;
  totalAmount: number;
  channels: "email" | "whatsapp" | "both";
  duplicateCount?: number;
  scheduleDate?: string;
  scheduleTime?: string;
  onScheduleChange?: (date: string, time: string) => void;
  onDueDateChange?: (date: string) => void;
  dueDay?: number;
  exactDueDate?: string;
  description?: string;
  onDescriptionChange?: (desc: string) => void;
  billingCategories?: string[];
  clientBreakdown?: { name: string; base: number; applyCredit: number; applyDebt: number; final: number }[];
  graceDays?: number;
  lateFeePct?: number;
  lateFeetrigger?: "after_grace" | "immediately" | "days_overdue";
  lateFeeTriggerDays?: number;
  lateFeeRecurring?: boolean;
}

// Estimated costs per channel (in ZAR)
const COST_PER_EMAIL = 0.05; // R0.05 per email via Resend
const COST_PER_WHATSAPP = 0.30; // R0.30 per WhatsApp message

export function SendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  mode,
  requestCount,
  totalAmount,
  channels,
  duplicateCount = 0,
  scheduleDate,
  scheduleTime,

  onScheduleChange,
  onDueDateChange,
  dueDay,
  exactDueDate,
  description = "",
  onDescriptionChange,
  billingCategories = [],
  clientBreakdown,
  graceDays = 0,
  lateFeePct = 0,
  lateFeetrigger = "after_grace",
  lateFeeTriggerDays = 3,
  lateFeeRecurring = false,
}: SendConfirmationDialogProps) {
  const fmtDMY = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  const getSASTNow = () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }),
      time: now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  };
  const [localDate, setLocalDate] = useState(() => scheduleDate ?? getSASTNow().date);
  const [localTime, setLocalTime] = useState(() => scheduleTime ?? getSASTNow().time);
  const localTimeRef = useRef(localTime);
  const onScheduleChangeRef = useRef(onScheduleChange);
  useEffect(() => { localTimeRef.current = localTime; });
  useEffect(() => { onScheduleChangeRef.current = onScheduleChange; });

  const computeInitialOffset = (sendDate: string): number => {
    if (!dueDay || !sendDate) return 7;
    const base = new Date(sendDate + "T00:00:00");
    let due = new Date(base.getFullYear(), base.getMonth(), dueDay);
    if (due <= base) due = new Date(base.getFullYear(), base.getMonth() + 1, dueDay);
    return Math.round((due.getTime() - base.getTime()) / 86400000);
  };

  const applyOffset = (sendDate: string, offset: number): string => {
    if (exactDueDate) return exactDueDate;
    if (!sendDate) return "";
    const safeOffset = Math.max(1, offset);
    const due = new Date(new Date(sendDate + "T00:00:00").getTime() + safeOffset * 86400000);
    return due.toISOString().split("T")[0];
  };

  const minDueDate = localDate
    ? new Date(new Date(localDate + "T00:00:00").getTime() + 86400000).toISOString().split("T")[0]
    : undefined;

  const [dueDateOffset, setDueDateOffset] = useState(() => computeInitialOffset(scheduleDate ?? ""));
  const [localDueDate, setLocalDueDate] = useState(() => applyOffset(scheduleDate ?? "", computeInitialOffset(scheduleDate ?? "")));
  const effectiveDueDate = localDueDate;

  useEffect(() => {
    if (open) {
      const { date: nowDate, time: nowTime } = getSASTNow();
      const d = scheduleDate || nowDate;
      const t = scheduleTime || nowTime;
      const offset = computeInitialOffset(d);
      setLocalDate(d);
      setLocalTime(t);
      setDueDateOffset(offset);
      setLocalDueDate(exactDueDate ?? applyOffset(d, offset));
      onScheduleChange?.(d, t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clamp time to now when today is selected — checked every 30s
  useEffect(() => {
    const check = () => {
      const { date: nd, time: nt } = getSASTNow();
      if (localDate === nd && localTimeRef.current < nt) {
        setLocalTime(nt);
        onScheduleChangeRef.current?.(localDate, nt);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [localDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slide due date by the same offset when send date changes
  useEffect(() => {
    if (!exactDueDate) setLocalDueDate(applyOffset(localDate, dueDateOffset));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDate]);

  // Notify parent whenever effective due date changes
  useEffect(() => {
    if (effectiveDueDate) onDueDateChange?.(effectiveDueDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDueDate]);

  const followUpDates = (() => {
    if (!effectiveDueDate) return [];
    const [fy, fm, fd] = effectiveDueDate.split("-").map(Number);
    const due = new Date(Date.UTC(fy, fm - 1, fd));
    const fmt = (d: Date) => d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    return [
      { label: "1 day before", date: fmt(add(due, -1)) },
      { label: "Due date",     date: fmt(due) },
      { label: "1 day after",  date: fmt(add(due,  1)) },
      { label: "3 days after", date: fmt(add(due,  3)) },
      { label: "7 days after", date: fmt(add(due,  7)) },
    ];
  })();
  const emailCount = channels === "email" || channels === "both" ? requestCount : 0;
  const whatsappCount = channels === "whatsapp" || channels === "both" ? requestCount : 0;
  const totalNotifications = emailCount + whatsappCount;

  const [showSchedule, setShowSchedule] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConfirmClick = () => {
    if (!description.trim()) {
      toast.error("Please describe what this payment is for before confirming.");
      return;
    }
    if (!armed) {
      setArmed(true);
      armTimerRef.current = setTimeout(() => setArmed(false), 3000);
    } else {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      setArmed(false);
      onConfirm();
    }
  };

  useEffect(() => {
    if (!open) {
      setArmed(false);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    }
  }, [open]);

  const isBatchMode = mode === "batch";
  const hasDuplicates = duplicateCount > 0;

  const lateFeeLabel = lateFeePct > 0
    ? `${lateFeePct}% late fee · ${{ after_grace: "after grace", immediately: "on due date", days_overdue: `after ${lateFeeTriggerDays} days overdue` }[lateFeetrigger]}${ lateFeeRecurring ? " · recurring" : ""}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base flex items-center gap-2">
            {isBatchMode && <AlertTriangle className="w-4 h-4 text-amber-500" />}
            Confirm Send
            {hasDuplicates && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
                <AlertTriangle className="w-3 h-3" /> {duplicateCount} duplicate{duplicateCount > 1 ? "s" : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          {/* Summary row — request count + total */}
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isBatchMode && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium"><AlertTriangle className="w-2.5 h-2.5" /> All Groups</span>}
              {requestCount} request{requestCount !== 1 ? "s" : ""}
            </span>
            <span className="text-base font-bold">R{totalAmount.toLocaleString()}</span>
          </div>

          {/* Grace period — own row, always visible when set */}
          {graceDays > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-800 font-medium">
                {graceDays}-day grace period — clients can still pay {graceDays} day{graceDays !== 1 ? "s" : ""} after the due date without penalty
              </span>
            </div>
          )}

          {/* Late fee — own row */}
          {lateFeePct > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs text-amber-800 font-medium">
                {lateFeePct}% late fee · {{ after_grace: "after grace period", immediately: "on due date", days_overdue: `after ${lateFeeTriggerDays} days overdue` }[lateFeetrigger]}{lateFeeRecurring ? " · recurring" : ""}
              </span>
            </div>
          )}

          {/* Per-client breakdown */}
          {clientBreakdown && clientBreakdown.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Who pays what</span>
                {lateFeeLabel && (
                  <span className="text-[10px] text-amber-600 font-medium normal-case">{lateFeeLabel}</span>
                )}
              </div>
              <div className="divide-y divide-border max-h-[8rem] overflow-y-auto">
                {clientBreakdown.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1 gap-2">
                    <span className="text-xs font-medium truncate max-w-[130px]">{c.name}</span>
                    <div className="text-right shrink-0 text-xs">
                      {(c.applyCredit > 0 || c.applyDebt > 0) ? (
                        <span className={c.final === 0 ? "text-primary font-bold" : "font-semibold"}>
                          {c.final === 0 ? "✓ R0 — covered" : `R${c.final.toLocaleString("en-ZA")}`}
                          {c.applyCredit > 0 && <span className="text-primary text-[10px] ml-1">−R{c.applyCredit.toLocaleString("en-ZA")} credit</span>}
                          {c.applyDebt > 0 && <span className="text-destructive text-[10px] ml-1">+R{c.applyDebt.toLocaleString("en-ZA")} arrears</span>}
                        </span>
                      ) : (
                        <span>R{c.base.toLocaleString("en-ZA")}</span>
                      )}
                    </div>
                  </div>
                ))}
                {clientBreakdown.length > 8 && (
                  <div className="px-3 py-1 text-[10px] text-muted-foreground">+{clientBreakdown.length - 8} more</div>
                )}
              </div>
            </div>
          )}

          {/* Description — read-only summary */}
          <div className="flex items-center justify-between rounded-md bg-muted/40 border border-border px-3 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Payment for</span>
            {description.trim() ? (
              <span className="text-xs font-semibold text-foreground">{description}</span>
            ) : (
              <span className="text-xs text-destructive font-medium">⚠ Not set — go back and fill in</span>
            )}
          </div>

          {/* Date / time / due date / grace period — 2 grouped columns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Send</span>
              <div className="flex gap-2">
                <Input type="date" value={localDate} min={getSASTNow().date} onChange={e => { setLocalDate(e.target.value); onScheduleChange?.(e.target.value, localTime); }} className="h-8 text-xs flex-1" />
                <Input type="time" value={localTime} min={localDate === getSASTNow().date ? getSASTNow().time : "00:00"} onChange={e => { setLocalTime(e.target.value); onScheduleChange?.(localDate, e.target.value); }} className="h-8 text-xs w-24" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Due Date</span>
              <div className="flex gap-2">
                <Input type="date" value={localDueDate} min={minDueDate} onChange={e => { const d = e.target.value; if (minDueDate && d < minDueDate) return; setLocalDueDate(d); if (localDate && d) { const gap = Math.round((new Date(d+"T00:00:00").getTime()-new Date(localDate+"T00:00:00").getTime())/86400000); if (gap>0) setDueDateOffset(gap); } }} className="h-8 text-xs flex-1" />
              </div>
            </div>
          </div>

          {/* Follow-ups — collapsed by default */}
          {followUpDates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSchedule(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
              >
                <Bell className="w-3 h-3 shrink-0" />
                <span className="flex-1 text-left">
                  {totalNotifications} reminders · {channels === "both" ? "Email + WhatsApp" : channels === "email" ? "Email" : "WhatsApp"}
                  {localDueDate && <> · due {fmtDMY(localDueDate)}</>}
                </span>
                <span className="text-[10px]">{showSchedule ? "▲" : "▼"}</span>
              </button>
              {showSchedule && (
                <div className="rounded-md border border-border overflow-hidden mt-1">
                  {followUpDates.map((fu, i) => (
                    <div key={i} className={`flex items-center justify-between px-2 py-0.5 text-[11px] ${
                      fu.label === "Due date" ? "bg-amber-50 font-medium" :
                      i === 0 ? "bg-sky-50" :
                      i > 1 ? "bg-red-50/50" : ""
                    } ${i > 0 ? "border-t border-border" : ""}`}>
                      <span className="text-muted-foreground">{fu.label}</span>
                      <span className="font-medium">{fu.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmClick}
            disabled={loading || !localDate}
            className={`gap-1.5 transition-colors ${armed ? "bg-amber-500 hover:bg-amber-600 border-amber-500" : ""}`}
          >
            {armed ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {loading ? "Processing..." : armed ? "Tap again to confirm" : "Confirm Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
