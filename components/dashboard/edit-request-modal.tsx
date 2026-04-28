"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface EditRequestModalProps {
  requestId: string;
  clientName: string;
  baseAmount: number;
  dueDate: string;
  graceEndDate: string | null;
  scheduledAt: string | null;
  description: string | null;
  customNote: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toSASTDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
const toSASTTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });
const nowSAST = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }),
    time: now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }),
  };
};

export function EditRequestModal({
  requestId,
  clientName,
  baseAmount,
  dueDate,
  graceEndDate,
  scheduledAt,
  description,
  customNote,
  open,
  onOpenChange,
}: EditRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [date, setDate] = useState("");
  const [graceDays, setGraceDays] = useState(0);
  const [note, setNote] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setAmount(String(baseAmount));
      setDate(dueDate);
      setNote(customNote ?? "");
      const gd = graceEndDate
        ? Math.round((new Date(graceEndDate).getTime() - new Date(dueDate).getTime()) / 86400000)
        : 0;
      setGraceDays(Math.max(0, gd));
      const { date: nd, time: nt } = nowSAST();
      if (scheduledAt && new Date(scheduledAt) > new Date()) {
        setSchedDate(toSASTDate(scheduledAt));
        setSchedTime(toSASTTime(scheduledAt));
      } else {
        setSchedDate(nd);
        setSchedTime(nt);
      }
    }
  }, [open, baseAmount, dueDate, graceEndDate, scheduledAt, customNote]);

  useEffect(() => {
    const check = () => {
      const { date: nd, time: nt } = nowSAST();
      if (schedDate === nd) setSchedTime(prev => (prev < nt ? nt : prev));
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [schedDate]);

  const buildScheduledAt = () =>
    new Date(`${schedDate}T${schedTime || "00:00"}:00`).toISOString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAmount = Number(amount);
    if (newAmount < 0) { toast.error("Amount cannot be negative"); return; }
    if (!schedDate) { toast.error("Scheduled date is required"); return; }
    if (date && date < schedDate) { toast.error("Due date cannot be before the scheduled date"); return; }
    const selectedDt = new Date(`${schedDate}T${schedTime || "00:00"}:00`);
    if (selectedDt <= new Date()) { toast.error("Scheduled time must be in the future"); return; }

    setLoading(true);

    const newScheduledAt = buildScheduledAt();
    const origScheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : null;

    const res = await fetch("/api/payments/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        baseAmount: newAmount !== baseAmount ? newAmount : undefined,
        dueDate: date !== dueDate ? date : undefined,
        graceDays: graceDays !== Math.max(0, graceEndDate ? Math.round((new Date(graceEndDate).getTime() - new Date(dueDate).getTime()) / 86400000) : 0) ? graceDays : undefined,
        scheduledAt: newScheduledAt !== origScheduledAt ? newScheduledAt : undefined,
        customNote: note !== (customNote ?? "") ? note : undefined,
      }),
    });

    const data = await res.json();

    if (data.success) {
      toast.success(`Updated payment request for ${clientName}`);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(data.error || "Failed to update");
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Edit Request
          </DialogTitle>
          <DialogDescription>Update payment request for {clientName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Price (R)</label>
            <Input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Scheduled</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Input
                  value={schedDate}
                  onChange={e => {
                    const newSched = e.target.value;
                    setSchedDate(newSched);
                    if (date && newSched && date < newSched) setDate(newSched);
                    if (newSched === nowSAST().date && schedTime < nowSAST().time) setSchedTime(nowSAST().time);
                  }}
                  type="date"
                  min={nowSAST().date}
                />
                {schedDate && <span className="text-[10px] text-muted-foreground">{fmtDate(schedDate)}</span>}
              </div>
              <Input
                value={schedTime}
                onChange={e => setSchedTime(e.target.value)}
                type="time"
                placeholder="HH:MM"
                min={schedDate === nowSAST().date ? nowSAST().time : "00:00"}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">SAST (UTC+2)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date</label>
              <Input
                value={date}
                onChange={e => setDate(e.target.value)}
                type="date"
                min={schedDate || undefined}
              />
              {date && <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(date)}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Grace Period (days)</label>
              <Input
                type="number"
                min="0"
                max="60"
                value={graceDays || ""}
                onChange={e => setGraceDays(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
              />
              {graceDays > 0 && date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Grace ends {fmtDate(new Date(new Date(date).getTime() + graceDays * 86400000).toISOString().split("T")[0])}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Note (optional)</label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
