"use client";

import { useState, useEffect, useMemo } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/utils";

interface OutstandingReq {
  id: string;
  request_number: string;
  total_due: number;
  amount_paid: number;
  outstanding: number;
  due_date: string;
}

interface Props {
  clientId: string;
  clientName: string;
  clientBalance: number;
}

export function RecordClientPaymentModal({ clientId, clientName, clientBalance }: Props) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<OutstandingReq[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [totalReceived, setTotalReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })
  );
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setLoadingReqs(true);
    const supabase = createClient();
    supabase
      .from("payment_requests")
      .select("id, request_number, total_due, amount_paid, outstanding, due_date")
      .eq("client_id", clientId)
      .neq("status", "paid")
      .gt("outstanding", 0)
      .order("due_date", { ascending: true })
      .then(({ data }) => {
        setRequests((data ?? []) as OutstandingReq[]);
        setLoadingReqs(false);
      });
  }, [open, clientId]);

  const totalOutstanding = requests.reduce((s, r) => s + Number(r.outstanding), 0);
  const received = parseFloat(totalReceived.replace(/[^\d.]/g, "")) || 0;

  const allocation = useMemo(() => {
    let remaining = received;
    return requests.map((req, idx) => {
      const isLast = idx === requests.length - 1;
      // Apply excess credit to the last request so it is persisted in the DB
      const applying = isLast ? remaining : Math.min(remaining, Number(req.outstanding));
      remaining = Math.max(remaining - applying, 0);
      return {
        ...req,
        applying,
        fullyPaid: applying >= Number(req.outstanding),
        leftover: Math.max(Number(req.outstanding) - applying, 0),
        overpaid: isLast ? Math.max(applying - Number(req.outstanding), 0) : 0,
      };
    });
  }, [requests, received]);

  const credit = Math.max(received - totalOutstanding, 0);
  const projectedBalance = clientBalance + received;

  const handleClose = () => {
    setOpen(false);
    setTotalReceived("");
    setPaymentDate(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }));
  };

  const handleConfirm = async () => {
    if (!received || received <= 0) { toast.error("Enter a valid amount"); return; }
    if (!paymentDate) { toast.error("Select a payment date"); return; }
    setSaving(true);
    const supabase = createClient();
    let count = 0;
    for (const alloc of allocation) {
      if (alloc.applying <= 0) continue;
      const { error } = await supabase.rpc("record_payment", {
        p_request_id: alloc.id,
        p_amount: alloc.applying,
        p_payment_date: paymentDate,
        p_method: "eft",
        p_reference: null,
      });
      if (error) {
        console.error("record_payment error:", error.message);
        toast.error(`Failed: ${error.message}`);
      } else {
        count++;
      }
    }
    const creditMsg = credit > 0 ? ` · +R${credit.toLocaleString("en-ZA")} credit on account` : "";
    toast.success(`R${received.toLocaleString("en-ZA")} recorded across ${count} request(s)${creditMsg}`);
    setSaving(false);
    handleClose();
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-xs h-7 px-2 gap-1 shrink-0"
      >
        <CreditCard className="w-3 h-3" />
        Record Payment
      </Button>

      <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="max-w-md gap-3">
          <DialogHeader>
            <DialogTitle>Record Payment — {clientName}</DialogTitle>
            <DialogDescription>
              Enter the total received. Funds are allocated oldest invoice first (FIFO).
            </DialogDescription>
          </DialogHeader>

          {loadingReqs ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading outstanding requests…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No outstanding requests for this client.</p>
          ) : (
            <>
              {/* Current account balance */}
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Account balance now</span>
                <span className={`font-semibold ${clientBalance > 0 ? "text-primary" : clientBalance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {clientBalance > 0 ? "+" : clientBalance < 0 ? "−" : ""}R{Math.abs(clientBalance).toLocaleString("en-ZA")}
                  {clientBalance > 0 && <span className="text-muted-foreground font-normal ml-1">(credit)</span>}
                  {clientBalance < 0 && <span className="text-muted-foreground font-normal ml-1">(owes)</span>}
                </span>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Total received</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={totalReceived}
                    onChange={e => setTotalReceived(e.target.value.replace(/[^\d.]/g, ""))}
                    className="pl-7 text-sm"
                    placeholder={totalOutstanding.toLocaleString("en-ZA")}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Total outstanding: <span className="font-medium text-destructive">R{totalOutstanding.toLocaleString("en-ZA")}</span>
                </p>
              </div>

              {/* Payment date */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Payment date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  max={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })}
                  className="h-8 text-xs"
                />
                {paymentDate && <p className="text-[10px] text-muted-foreground">{fmtDate(paymentDate)}</p>}
              </div>

              {/* Projected balance */}
              {received > 0 && (
                <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balance after recording</span>
                  <span className={`font-semibold ${projectedBalance > 0 ? "text-primary" : projectedBalance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {projectedBalance > 0 ? "+" : projectedBalance < 0 ? "−" : ""}R{Math.abs(projectedBalance).toLocaleString("en-ZA")}
                    {projectedBalance > 0 && <span className="text-muted-foreground font-normal ml-1">(credit)</span>}
                    {projectedBalance < 0 && <span className="text-muted-foreground font-normal ml-1">(still owes)</span>}
                  </span>
                </div>
              )}

              {/* FIFO allocation preview */}
              {received > 0 && (
                <div className="border border-border rounded-lg overflow-hidden text-sm">
                  <div className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Allocation — oldest first
                  </div>
                  <div className="divide-y divide-border max-h-44 overflow-y-auto">
                    {allocation.map(alloc => (
                      <div key={alloc.id} className="flex items-center justify-between px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{alloc.request_number}</p>
                          <p className="text-[10px] text-muted-foreground">Due {fmtDate(alloc.due_date)} · Owed R{Number(alloc.outstanding).toLocaleString("en-ZA")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {alloc.applying > 0 ? (
                            <>
                              <p className={`text-xs font-semibold ${alloc.fullyPaid ? "text-primary" : "text-amber-600"}`}>
                                R{alloc.applying.toLocaleString("en-ZA")} applied
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {alloc.overpaid > 0
                                  ? `Cleared ✓ · +R${alloc.overpaid.toLocaleString("en-ZA")} credit saved`
                                  : alloc.fullyPaid ? "Cleared ✓" : `R${alloc.leftover.toLocaleString("en-ZA")} still owed`}
                              </p>
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Not covered</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {credit > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-primary/5">
                        <p className="text-xs font-medium text-primary">Credit carried to next bill</p>
                        <p className="text-xs font-bold text-primary">+R{credit.toLocaleString("en-ZA")}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || received <= 0 || requests.length === 0 || !paymentDate}
              className="flex-1"
            >
              {saving ? "Processing…" : `Confirm R${received > 0 ? received.toLocaleString("en-ZA") : "—"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
