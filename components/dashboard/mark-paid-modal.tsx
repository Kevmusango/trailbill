"use client";

import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface MarkPaidModalProps {
  requestId: string;
  clientId: string;
  clientName: string;
  totalDue: number;
  outstanding: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidModal({ requestId, clientId, clientName, totalDue, outstanding, open, onOpenChange }: MarkPaidModalProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(outstanding.toString());
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }));
  const [method, setMethod] = useState("eft");
  const [reference, setReference] = useState("");
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const router = useRouter();

  const credit = accountBalance !== null && accountBalance > 0 ? accountBalance : 0;
  const suggestedCash = Math.max(outstanding - credit, 0);

  useEffect(() => {
    if (!open) return;
    setAmount(outstanding.toString());
    setAccountBalance(null);
    const supabase = createClient();
    supabase
      .from("payment_requests")
      .select("base_amount, amount_paid")
      .eq("client_id", clientId)
      .then(({ data }) => {
        if (!data) return;
        const bal = data.reduce((s, r) => s + Number(r.amount_paid) - Number(r.base_amount), 0);
        setAccountBalance(bal);
        if (bal > 0) setAmount(String(Math.max(outstanding - bal, 0)));
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountNum = Number(amount) || 0;
  const diff = amountNum - outstanding;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) { toast.error("Amount must be greater than 0"); return; }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc("record_payment", {
      p_request_id: requestId,
      p_amount: amountNum,
      p_payment_date: paymentDate,
      p_method: method,
      p_reference: reference.trim() || null,
    });

    if (error) {
      toast.error("Failed to record payment");
      setLoading(false);
      return;
    }

    const result = data as { success: boolean; new_status: string; outstanding: number };
    if (result.success) {
      toast.success(`Payment of R${amountNum.toLocaleString()} recorded for ${clientName}`);
      if (diff > 0) {
        toast.info(`Overpaid by R${diff.toLocaleString()} — credit will carry to next month`);
      } else if (diff < 0) {
        toast.warning(`R${Math.abs(diff).toLocaleString()} remaining — will carry to next month`);
      }
    } else {
      toast.error("Payment recording failed");
    }

    onOpenChange(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-2 max-w-sm">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            Mark as Paid — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center justify-between gap-4 text-xs">
          <div className="flex gap-3">
            <span className="text-muted-foreground">Due <span className="font-semibold text-foreground">R{totalDue.toLocaleString()}</span></span>
            <span className="text-muted-foreground">Owed <span className="font-semibold text-destructive">R{outstanding.toLocaleString()}</span></span>
          </div>
          {credit > 0 && (
            <span className="font-semibold text-primary text-xs">+R{credit.toLocaleString("en-ZA")} credit</span>
          )}
        </div>

        {credit > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-1.5 text-xs text-primary font-medium">
            {suggestedCash === 0
              ? `✓ Credit covers this — collect R0 from ${clientName}`
              : `Credit applied — collect R${suggestedCash.toLocaleString("en-ZA")} from ${clientName}`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Amount (R) *</label>
              <Input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-sm"
                autoFocus
              />
              {amountNum > 0 && diff !== 0 && (
                <p className={`text-[10px] mt-0.5 font-medium ${diff > 0 ? "text-primary" : "text-amber-600"}`}>
                  {diff > 0 ? `+R${diff.toLocaleString("en-ZA")} credit` : `R${Math.abs(diff).toLocaleString("en-ZA")} still owed`}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Date</label>
              <Input value={paymentDate} onChange={e => setPaymentDate(e.target.value)} type="date" className="h-8 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Method</label>
            <div className="grid grid-cols-4 gap-1.5">
              {["eft", "cash", "card", "other"].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors border capitalize ${
                    method === m
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Reference <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank reference or receipt #" className="h-8 text-sm" />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
