"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentPageClientProps {
  token: string;
  businessName: string;
  businessLogo: string | null;
  clientName: string;
  requestNumber: string;
  description: string;
  totalDue: number;
  baseAmount: number;
  previousBalance: number;
  dueDate: string;
  graceEndDate: string | null;
  finalDueDate: string | null;
  committedDate: string | null;
  extraDaysRequested: number;
  lateFee: number;
  status: string;
  bankName: string | null;
  accountNumber: string | null;
  branchCode: string | null;
  accountType: string | null;
  initialAction: "pay" | "extra" | null;
}

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-sm shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</span>
        <button
          onClick={copy}
          className="shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title={`Copy ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000
  );
}

export function PaymentPageClient(props: PaymentPageClientProps) {
  const {
    token, businessName, businessLogo, clientName, requestNumber, description,
    totalDue, previousBalance, dueDate, graceEndDate, finalDueDate,
    committedDate: committedDateProp, extraDaysRequested, lateFee, status,
    bankName, accountNumber, branchCode, accountType, initialAction,
  } = props;

  const dueDateStr = dueDate.split("T")[0];

  const [today, setToday] = useState("");
  const [panel, setPanel] = useState<null | "pay">(null);

  useEffect(() => {
    const t = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    setToday(t);
    setChosenDate(dueDateStr);
    if (initialAction) setPanel("pay");
  }, []);
  const [chosenDate, setChosenDate] = useState("");
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(!!committedDateProp);
  const [committedDate, setCommittedDate] = useState<string | null>(committedDateProp);
  const [committedType, setCommittedType] = useState<"date" | "extra" | null>(
    committedDateProp ? (extraDaysRequested > 0 ? "extra" : "date") : null
  );
  const [committedAmount, setCommittedAmount] = useState<number>(totalDue);

  const trackEvent = (event_type: string) => {
    fetch("/api/payments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, event_type }),
    }).catch(() => {});
  };

  // --- Rate & zone calculation ---
  function calcAmount(dateStr: string): number {
    if (!graceEndDate || lateFee <= 0) return totalDue;
    if (dateStr <= graceEndDate) return totalDue;
    return totalDue * (1 + lateFee / 100);
  }

  function getZone(dateStr: string): "on-time" | "grace" | "late" {
    if (dateStr <= dueDateStr) return "on-time";
    if (graceEndDate && dateStr <= graceEndDate) return "grace";
    return "late";
  }

  const maxDate = finalDueDate ?? addDays(graceEndDate ?? dueDateStr, 30);
  const chosenZone  = chosenDate ? getZone(chosenDate) : "on-time";
  const chosenAmount = chosenDate ? calcAmount(chosenDate) : totalDue;
  const graceDays = graceEndDate ? Math.max(0, daysBetween(dueDateStr, graceEndDate)) : 0;

  // --- Unified confirm handler ---
  const handleConfirm = async () => {
    if (!chosenDate) return;
    setCommitting(true);
    try {
      if (chosenDate <= dueDateStr) {
        const res = await fetch("/api/payments/commit-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, date: chosenDate, amount: chosenAmount }),
        });
        const data = await res.json();
        if (!data.success) { toast.error(data.error ?? "Failed to set date"); return; }
        setCommittedDate(chosenDate);
        setCommittedType("date");
        setCommittedAmount(totalDue);
        setCommitted(true);
        setPanel(null);
        trackEvent("payment_date_chosen");
        fetch("/api/payments/send-commitment-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      } else {
        const extraDays = daysBetween(dueDateStr, chosenDate);
        const supabase = createClient();
        const { data, error } = await supabase.rpc("record_commitment", {
          p_token: token,
          p_extra_days: extraDays,
        });
        if (error || !(data as { success: boolean })?.success) {
          toast.error("Failed to request extra days"); return;
        }
        const result = data as { success: boolean; committed_date: string };
        // Persist the accepted amount
        await supabase.from("payment_requests")
          .update({ committed_amount: chosenAmount })
          .eq("public_token", token);
        setCommittedDate(result.committed_date);
        setCommittedType("extra");
        setCommittedAmount(chosenAmount);
        setCommitted(true);
        setPanel(null);
        trackEvent("extra_days_requested");
        fetch("/api/payments/send-commitment-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      }
    } finally { setCommitting(false); }
  };

  const hasBanking = !!(bankName || accountNumber || branchCode || accountType);

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">

        {/* Compact header + amount */}
        <div className="bg-primary px-4 pt-4 pb-4 text-white">
          <div className="flex items-center gap-3 mb-3">
            {businessLogo ? (
              <img src={businessLogo} alt={businessName} className="h-9 max-w-[110px] rounded-lg object-contain bg-white px-1.5 py-0.5 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {businessName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">{businessName}</p>
              <p className="text-xs opacity-75 truncate">for {clientName}{description ? ` · ${description}` : ""}</p>
            </div>
          </div>
          {(() => {
            const displayAmount = committed ? committedAmount
              : panel === "pay" && chosenDate ? chosenAmount
              : totalDue;
            const displayDate = committed ? committedDate ?? dueDateStr
              : panel === "pay" && chosenDate ? chosenDate
              : dueDateStr;
            const amountChanged = displayAmount !== totalDue;
            const dateChanged = displayDate !== dueDateStr;
            return (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] opacity-70 uppercase tracking-wide">Amount Due</p>
                  <p className="text-3xl font-black leading-tight">{fmtMoney(displayAmount)}</p>
                  {amountChanged && (
                    <p className="text-xs opacity-60 line-through">{fmtMoney(totalDue)}</p>
                  )}
                </div>
                <div className="text-right text-xs opacity-80">
                  <p>Due: <span className={`font-semibold ${dateChanged ? "text-yellow-200" : ""}`}>{fmtDate(displayDate)}</span></p>
                  {dateChanged && (
                    <p className="text-[10px] opacity-60 line-through">{fmtDate(dueDateStr)}</p>
                  )}
                  <p className="opacity-70">Ref: {requestNumber}</p>
                  {previousBalance !== 0 && (
                    <p className={previousBalance > 0 ? "text-red-200" : "text-green-200"}>
                      {previousBalance > 0 ? "+" : "−"}{fmtMoney(Math.abs(previousBalance))}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* PAID state */}
        {status === "paid" && (
          <div className="px-4 py-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <CheckCircle2 className="w-9 h-9 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800">Payment received — thank you! 🙏</p>
            </div>
          </div>
        )}

        {/* COMMITTED state */}
        {status !== "paid" && committed && (
          <div className="px-4 py-4 space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-7 h-7 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-green-800">
                {committedType === "extra" ? "Extension confirmed 👍" : "Payment date confirmed ✓"}
              </p>
              <p className="text-sm text-green-700 mt-1">
                Pay by: <span className="font-bold">{fmtDate(committedDate!)}</span>
              </p>
              <p className="text-sm font-bold text-green-800 mt-1">{fmtMoney(committedAmount)}</p>
              <p className="text-xs text-green-600 mt-1">Reminders will be sent for this date</p>
            </div>

            {/* Banking details — shown after commit */}
            {hasBanking && (
              <div className="rounded-xl border border-primary/20 p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Banking Details</p>
                </div>
                <div className="space-y-2.5">
                  {bankName && <CopyRow label="Bank" value={bankName} />}
                  {accountNumber && <CopyRow label="Account" value={accountNumber} mono />}
                  {branchCode && <CopyRow label="Branch" value={branchCode} mono />}
                  {accountType && <CopyRow label="Type" value={accountType} />}
                  <div className="pt-2 border-t border-primary/20">
                    <CopyRow label="Reference" value={requestNumber} mono />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Use the reference so your payment can be matched
                </p>
              </div>
            )}
          </div>
        )}

        {/* ACTION area — not paid, not committed */}
        {status !== "paid" && !committed && (
          <div className="px-4 pb-4 pt-4">

            {/* ── Unified date picker panel ── */}
            {panel === "pay" && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-center">Pick your payment date</p>
                <input
                  type="date"
                  min={today}
                  max={maxDate}
                  value={chosenDate}
                  onChange={e => setChosenDate(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-primary/30 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                {/* Grace zone legend */}
                {graceEndDate && (
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="flex items-center gap-1 text-green-700 font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
                      🎁 Free until <strong>{fmtDate(graceEndDate)}</strong>
                    </span>
                    {lateFee > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                        +{lateFee}% flat fee after
                      </span>
                    )}
                  </div>
                )}

                {/* Zone card — updates live */}
                {chosenDate && (
                  <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between transition-all ${
                    chosenZone === "late" ? "bg-amber-50 border-amber-300" : "bg-green-50 border-green-300"
                  }`}>
                    <div>
                      <p className={`text-sm font-bold ${
                        chosenZone === "late" ? "text-amber-900" : "text-green-900"
                      }`}>{fmtDate(chosenDate)}</p>
                      <p className={`text-xs mt-0.5 ${
                        chosenZone === "late" ? "text-amber-600" : "text-green-600"
                      }`}>
                        {chosenZone === "on-time" && "✓ On time — no extra charge"}
                        {chosenZone === "grace"   && "🎁 Grace period — no extra charge"}
                        {chosenZone === "late"    && `⚠️ +${lateFee}% flat late fee applies`}
                      </p>
                    </div>
                    <p className={`text-lg font-black ${
                      chosenZone === "late" ? "text-amber-700" : "text-green-700"
                    }`}>{fmtMoney(chosenAmount)}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setPanel(null)} className="h-11">Back</Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!chosenDate || committing}
                    className={`h-11 ${
                      chosenZone === "late" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                    }`}
                  >
                    {committing ? "Confirming…" : "Confirm →"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Single CTA view ── */}
            {panel === null && (
              <div className="space-y-3">
                {/* Urgency banner */}
                {lateFee > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-amber-800 leading-snug">
                      ⚠️ Miss {fmtDate(dueDateStr)} →{" "}
                      <strong>{lateFee}% flat fee</strong>{" "}
                      starts automatically.
                    </p>
                  </div>
                )}

                {/* Grace banner */}
                {graceDays > 0 && graceEndDate && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-green-800 leading-snug">
                      🎁 You have <strong>{graceDays} free grace days</strong> (until{" "}
                      {fmtDate(graceEndDate)}) — pick any date in that window and pay{" "}
                      <strong>{fmtMoney(totalDue)}</strong>, nothing added.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setPanel("pay")}
                  className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base transition-colors"
                >
                  📅 Pick your payment date →
                </button>

                <p className="text-[11px] text-center text-muted-foreground">
                  Powered by <span className="font-medium">Trailbill</span>
                </p>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
