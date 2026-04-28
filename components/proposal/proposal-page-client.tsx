"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type PaymentTerm = { label: string; parts?: number[] };

function fmtMoney(n: number) {
  return n.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function getNextMonths(count = 18) {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
    });
  }
  return months;
}

const today = new Date().toISOString().split("T")[0];

export function ProposalPageClient({
  token, businessName, businessLogo, clientName, title, description,
  amount, paymentTerms, allowCounter, minCounterAmount, expiryDate, status,
  revisedAmount, revisedNote, previousStartDate, previousStartMonthOnly, previousPaymentTerm,
}: {
  token: string;
  businessName: string;
  businessLogo: string | null;
  clientName: string;
  title: string;
  description: string | null;
  amount: number;
  paymentTerms: PaymentTerm[];
  allowCounter: boolean;
  minCounterAmount: number | null;
  expiryDate: string;
  status: string;
  revisedAmount?: number | null;
  revisedNote?: string | null;
  previousStartDate?: string | null;
  previousStartMonthOnly?: boolean;
  previousPaymentTerm?: string | null;
}) {
  const prevMode = previousStartMonthOnly ? "month" : (previousStartDate ? "date" : "month");
  const [startMode, setStartMode] = useState<"date" | "month">(prevMode);
  const [startDate, setStartDate] = useState(previousStartMonthOnly ? "" : (previousStartDate ?? ""));
  const [startMonth, setStartMonth] = useState(previousStartMonthOnly ? (previousStartDate ?? "") : "");
  const [selectedTerm, setSelectedTerm] = useState<string>(previousPaymentTerm ?? paymentTerms[0]?.label ?? "");
  const [declining, setDeclining] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneStatus, setDoneStatus] = useState<"accepted" | "revised_requested" | "declined">("accepted");

  const isExpired = status === "expired" || expiryDate < today;
  const isOwnerRevised = status === "owner_revised";
  const isAlreadyDone = status === "accepted" || status === "revised_requested";
  const isDeclined = status === "declined";
  const months = getNextMonths();

  const hasDate = startMode === "month" ? !!startMonth : !!startDate;
  const hasTerm = paymentTerms.length === 0 || !!selectedTerm;
  const counterBelowMin = !!(showCounter && minCounterAmount && counterAmount && Number(counterAmount) < minCounterAmount);
  const canSubmit = hasDate && hasTerm && !counterBelowMin;

  const getResolvedStartDate = () => {
    if (startMode === "month") return startMonth;
    return startDate;
  };

  const handleSubmit = async (isCounter: boolean) => {
    const resolvedDate = getResolvedStartDate();
    if (!resolvedDate) {
      toast.error(startMode === "month" ? "Please select a start month" : "Please select a start date");
      return;
    }
    if (paymentTerms.length > 0 && !selectedTerm) {
      toast.error("Please select a payment term");
      return;
    }
    if (isCounter && !counterAmount) {
      toast.error("Please enter your counter offer amount");
      return;
    }
    if (isCounter && minCounterAmount && Number(counterAmount) < minCounterAmount) {
      toast.error(`Minimum counter is ${fmtMoney(minCounterAmount)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          startDate: resolvedDate,
          startMonthOnly: startMode === "month",
          selectedPaymentTerm: selectedTerm || null,
          counterAmount: isCounter ? Number(counterAmount) : null,
          counterNote: isCounter ? counterNote : null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      setDoneStatus(data.status);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="bg-primary px-4 pt-4 pb-4 text-white">
            <div className="flex items-center gap-3">
              {businessLogo ? (
                <img src={businessLogo} alt={businessName} className="h-9 max-w-[110px] rounded-lg object-contain bg-white px-1.5 py-0.5 shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {businessName.charAt(0)}
                </div>
              )}
              <p className="text-sm font-bold">{businessName}</p>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            {doneStatus === "accepted" && <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />}
            {doneStatus === "revised_requested" && <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-amber-500" />}
            {doneStatus === "declined" && <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />}
            {doneStatus === "accepted" && (
              <>
                <p className="text-lg font-bold text-green-800">Proposal Accepted!</p>
                <p className="text-sm text-muted-foreground mt-1">{businessName} will be in touch to confirm next steps.</p>
              </>
            )}
            {doneStatus === "revised_requested" && (
              <>
                <p className="text-lg font-bold text-amber-800">Counter Offer Submitted</p>
                <p className="text-sm text-muted-foreground mt-1">{businessName} will review your offer and get back to you.</p>
              </>
            )}
            {doneStatus === "declined" && (
              <>
                <p className="text-lg font-bold text-red-700">Offer Declined</p>
                <p className="text-sm text-muted-foreground mt-1">{businessName} has been notified.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-4 pt-3 pb-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {businessLogo ? (
                <img src={businessLogo} alt={businessName} className="h-7 max-w-[80px] rounded object-contain bg-white px-1 py-0.5 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {businessName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{businessName}</p>
                <p className="text-[10px] opacity-70">for {clientName}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] opacity-70 uppercase tracking-wide">{title}</p>
              <p className="text-xl font-black leading-tight">{fmtMoney(amount)}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* Expired / Already done */}
          {isExpired && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-red-700">This proposal has expired</p>
              <p className="text-xs text-red-500 mt-1">Valid until {fmtDate(expiryDate)}</p>
            </div>
          )}

          {isAlreadyDone && !isExpired && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-green-700">
                {status === "accepted" ? "You have already accepted this proposal." : "Your counter offer was submitted — waiting for response."}
              </p>
            </div>
          )}

          {isDeclined && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-red-700">You declined the final offer.</p>
              <p className="text-xs text-red-500 mt-1">{businessName} has been notified.</p>
            </div>
          )}

          {isOwnerRevised && revisedAmount && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Final offer from {businessName}</p>
                <p className="text-2xl font-black text-blue-800">{fmtMoney(revisedAmount)}</p>
                {revisedNote && <p className="text-xs text-blue-600 mt-1">&ldquo;{revisedNote}&rdquo;</p>}
                <p className="text-xs text-blue-500 mt-1">This is their final price. Accept to confirm.</p>
              </div>
            </div>
          )}

          {!isExpired && !isAlreadyDone && !isOwnerRevised && (
            <>
              {/* Description */}
              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              )}

              {/* Expiry + start date combined row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Valid until <strong className="text-foreground ml-0.5">{fmtDate(expiryDate)}</strong></span>
                {!hasDate && <span className="text-red-500 font-medium">* pick a start date</span>}
              </div>

              {/* Start date section */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">When to start <span className="text-red-500">*</span></p>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                  <button onClick={() => setStartMode("month")} className={`flex-1 py-1.5 transition-colors ${startMode === "month" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>Month</button>
                  <button onClick={() => setStartMode("date")} className={`flex-1 py-1.5 transition-colors ${startMode === "date" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>Exact date</button>
                </div>
                {startMode === "month" ? (
                  <div className="relative">
                    <select value={startMonth} onChange={e => setStartMonth(e.target.value)}
                      className={`w-full h-9 rounded-lg border-2 bg-background px-3 pr-8 text-sm focus:outline-none appearance-none transition-colors ${startMonth ? "border-primary/40" : "border-red-300 bg-red-50/30"}`}>
                      <option value="">Select a month…</option>
                      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                ) : (
                  <input type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)}
                    className={`w-full h-9 rounded-lg border-2 bg-background px-3 text-sm focus:outline-none transition-colors ${startDate ? "border-primary/40" : "border-red-300 bg-red-50/30"}`} />
                )}
              </div>

              {/* Payment terms — compact radio list */}
              {paymentTerms.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment terms</p>
                  <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {paymentTerms.map((term) => (
                      <label key={term.label} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selectedTerm === term.label ? "bg-primary/8" : "hover:bg-muted/50"}`}>
                        <input type="radio" name="payment_term" value={term.label} checked={selectedTerm === term.label} onChange={() => setSelectedTerm(term.label)} className="accent-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{term.label}</p>
                          {term.parts && selectedTerm === term.label && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                              {term.parts.map((p) => fmtMoney(amount * p / 100)).join(" + ")}
                            </p>
                          )}
                        </div>
                        {selectedTerm === term.label && <span className="text-primary text-xs font-bold shrink-0">✓</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Counter offer section */}
              {showCounter && allowCounter && (
                <div className="space-y-2 border border-amber-200 bg-amber-50 rounded-xl p-3">
                  <p className="text-sm font-semibold text-amber-800">Your counter offer</p>
                  {minCounterAmount && (
                    <p className="text-xs text-amber-600">Minimum: {fmtMoney(minCounterAmount)}</p>
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={minCounterAmount ?? 0}
                      value={counterAmount}
                      onChange={e => setCounterAmount(e.target.value)}
                      onWheel={e => (e.target as HTMLElement).blur()}
                      placeholder="0"
                      className={`w-full h-11 rounded-xl border-2 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 transition-colors ${
                        counterBelowMin
                          ? "border-red-400 focus:ring-red-300 bg-red-50"
                          : "border-amber-300 focus:ring-amber-300"
                      }`}
                    />
                  </div>
                  {counterBelowMin && (
                    <p className="text-xs font-medium text-red-600">⚠ Must be at least {fmtMoney(minCounterAmount!)}</p>
                  )}
                  <textarea
                    value={counterNote}
                    onChange={e => setCounterNote(e.target.value)}
                    placeholder="Add a note (optional)…"
                    rows={2}
                    className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {!showCounter ? (
                  <>
                    <Button className="w-full h-10 text-sm font-bold" onClick={() => handleSubmit(false)} disabled={submitting || !canSubmit} title={!hasDate ? "Select a start date first" : !hasTerm ? "Select a payment term" : ""}>
                      {submitting ? "Submitting…" : "✅ Accept Proposal"}
                    </Button>
                    {allowCounter && (
                      <Button variant="outline" className="w-full h-9 text-sm" onClick={() => setShowCounter(true)} disabled={!canSubmit} title={!hasDate ? "Select a start date first" : ""}>
                        💬 Counter Offer
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-9" onClick={() => setShowCounter(false)}>Back</Button>
                    <Button className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => handleSubmit(true)} disabled={submitting || !canSubmit}>
                      {submitting ? "Sending…" : "Submit →"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Owner sent final price — show pre-filled summary, Accept or Decline */}
          {isOwnerRevised && !isExpired && revisedAmount && (
            <>
              {/* Pre-filled summary — read only */}
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1.5 text-sm">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Your previously selected details</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">📅 Start</span>
                  <span className="font-medium">
                    {previousStartDate ? fmtDate(previousStartDate) : "—"}
                    {previousStartMonthOnly ? " (month)" : ""}
                  </span>
                </div>
                {selectedTerm && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">💳 Payment</span>
                    <span className="font-medium">{selectedTerm}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 text-sm font-medium border-red-200 text-red-600 hover:bg-red-50"
                  disabled={declining || submitting}
                  onClick={async () => {
                    setDeclining(true);
                    const res = await fetch("/api/proposals/decline", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token }),
                    });
                    const data = await res.json();
                    if (data.success) { setDoneStatus("declined"); setDone(true); }
                    else { toast.error(data.error ?? "Something went wrong"); setDeclining(false); }
                  }}
                >
                  {declining ? "…" : "✕ Decline"}
                </Button>
                <Button
                  className="h-10 text-sm font-bold"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || declining || !canSubmit}
                >
                  {submitting ? "Submitting…" : "✅ Accept"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
