"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function fmtMoney(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  reviewToken: string;
  businessName: string;
  businessLogo: string | null;
  clientName: string;
  proposalTitle: string;
  originalAmount: number;
  counterAmount: number;
  counterNote: string | null;
  selectedPaymentTerm: string | null;
  startDate: string;
  startMonthOnly: boolean;
  alreadyReviewed: boolean;
  ownerAction: string | null;
  revisedAmount: number | null;
}

export function ReviewPageClient({
  reviewToken, businessName, businessLogo, clientName, proposalTitle,
  originalAmount, counterAmount, counterNote, selectedPaymentTerm,
  startDate, startMonthOnly, alreadyReviewed, ownerAction, revisedAmount,
}: Props) {
  const [mode, setMode] = useState<"idle" | "finalPrice">("idle");
  const [finalPrice, setFinalPrice] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneAction, setDoneAction] = useState<"approved" | "revised" | null>(null);

  const handleAction = async (action: "approved" | "revised") => {
    if (action === "revised") {
      if (!finalPrice || Number(finalPrice) <= 0) { toast.error("Enter a valid final price"); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: reviewToken,
          action,
          revisedAmount: action === "revised" ? Number(finalPrice) : null,
          revisedNote: finalNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error ?? "Something went wrong"); return; }
      setDoneAction(action);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done && doneAction) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="bg-primary px-4 pt-3 pb-3 text-white">
            <div className="flex items-center gap-2">
              {businessLogo
                ? <img src={businessLogo} alt={businessName} className="h-7 rounded object-contain bg-white px-1 py-0.5 shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{businessName.charAt(0)}</div>}
              <p className="text-sm font-bold">{businessName}</p>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            {doneAction === "approved" ? (
              <>
                <p className="text-lg font-bold text-green-800">Counter Approved!</p>
                <p className="text-sm text-muted-foreground mt-1">{clientName} has been notified that you accepted their offer.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-blue-800">Final Price Sent!</p>
                <p className="text-sm text-muted-foreground mt-1">{clientName} has been notified of your final offer of {fmtMoney(Number(finalPrice))}.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (alreadyReviewed) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="bg-primary px-4 pt-3 pb-3 text-white">
            <div className="flex items-center gap-2">
              {businessLogo
                ? <img src={businessLogo} alt={businessName} className="h-7 rounded object-contain bg-white px-1 py-0.5 shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{businessName.charAt(0)}</div>}
              <p className="text-sm font-bold">{businessName}</p>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            <XCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-base font-semibold">Already Reviewed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {ownerAction === "approved"
                ? `You approved ${clientName}'s counter offer.`
                : `You sent a final price of ${fmtMoney(Number(revisedAmount))} to ${clientName}.`}
            </p>
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
              {businessLogo
                ? <img src={businessLogo} alt={businessName} className="h-7 max-w-[80px] rounded object-contain bg-white px-1 py-0.5 shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">{businessName.charAt(0)}</div>}
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{businessName}</p>
                <p className="text-[10px] opacity-70">Review counter offer</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] opacity-70 uppercase tracking-wide">{proposalTitle}</p>
              <p className="text-base font-black leading-tight">{fmtMoney(originalAmount)}</p>
              <p className="text-[10px] opacity-70">your ask</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">

          {/* Client's counter details */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              {clientName}&apos;s Counter Offer
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-700">{fmtMoney(counterAmount)}</span>
              <span className="text-xs text-amber-600">vs your {fmtMoney(originalAmount)}</span>
            </div>
            <div className="space-y-1 text-xs text-amber-700">
              <p>📅 Start: <strong>{startMonthOnly ? fmtDate(startDate) : fmtDate(startDate)}{startMonthOnly ? " (month)" : ""}</strong></p>
              {selectedPaymentTerm && <p>💳 Payment: <strong>{selectedPaymentTerm}</strong></p>}
              {counterNote && <p>📝 Note: &ldquo;{counterNote}&rdquo;</p>}
            </div>
          </div>

          {/* Actions */}
          {mode === "idle" && (
            <div className="space-y-2">
              <Button
                className="w-full h-10 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction("approved")}
                disabled={submitting}
              >
                {submitting ? "Approving…" : `✅ Approve ${fmtMoney(counterAmount)}`}
              </Button>
              <Button
                variant="outline"
                className="w-full h-10 text-sm font-medium"
                onClick={() => setMode("finalPrice")}
              >
                💬 Set My Final Price
              </Button>
            </div>
          )}

          {mode === "finalPrice" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Your final price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={finalPrice}
                    onChange={e => setFinalPrice(e.target.value)}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0"
                    className="pl-8 h-10 text-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Note to client <span className="font-normal">(optional)</span>
                </label>
                <Input
                  value={finalNote}
                  onChange={e => setFinalNote(e.target.value)}
                  placeholder="e.g. Best I can do given the scope…"
                  className="h-10 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-9 text-sm" onClick={() => setMode("idle")} disabled={submitting}>
                  Back
                </Button>
                <Button className="h-9 text-sm font-bold" onClick={() => handleAction("revised")} disabled={submitting}>
                  {submitting ? "Sending…" : "Send Final Price →"}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
