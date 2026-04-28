"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BusinessActionsProps {
  businessId: string;
  businessName: string;
  subscriptionStart: string | null;
  subscriptionDays: number;
  creditsRemaining: number;
  creditsMonthly: number;
}

export function BusinessActions({ businessId, businessName, subscriptionStart, subscriptionDays, creditsRemaining, creditsMonthly }: BusinessActionsProps) {
  const [subOpen, setSubOpen]           = useState(false);
  const [creditsOpen, setCreditsOpen]   = useState(false);
  const [days, setDays]               = useState(subscriptionDays.toString());
  const [selectedPack, setSelectedPack] = useState<50 | 100>(100);
  const [loading, setLoading]         = useState(false);
  const router = useRouter();

  // Renew subscription dates only — does NOT touch credits
  const renewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const daysNum = Math.max(1, Number(days));
    const end = new Date();
    end.setDate(end.getDate() + daysNum);
    const endDateStr = end.toISOString().split("T")[0];

    const { error } = await supabase.from("businesses").update({
      subscription_start:  new Date().toISOString(),
      subscription_days:   daysNum,
      subscription_end:    endDateStr,
      subscription_active: true,
      credits_remaining:   creditsMonthly,
    }).eq("id", businessId);

    if (error) { toast.error("Failed to renew: " + error.message); setLoading(false); return; }
    toast.success(`${businessName} — subscription renewed for ${daysNum} days`);
    setSubOpen(false);
    setLoading(false);
    router.refresh();
  };

  // Add credits only — does NOT touch subscription dates
  const addCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const creditsNum = selectedPack;

    const { error } = await supabase.rpc("topup_credits", {
      p_business_id: businessId,
      p_credits:     creditsNum,
    });

    if (error) { toast.error("Failed to add credits: " + error.message); setLoading(false); return; }
    toast.success(`${businessName} — +${creditsNum} credits added`);
    setCreditsOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
      <Button size="sm" variant="outline" onClick={() => setCreditsOpen(true)} className="text-xs h-8">
        Credits
      </Button>
      <Button size="sm" variant="outline" onClick={() => setSubOpen(true)} className="text-xs h-8">
        Subscription
      </Button>
      {/* ── Subscription dialog (dates only) ── */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription — {businessName}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-0.5">
            {subscriptionStart && (
              <p><span className="text-muted-foreground">Started:</span> {new Date(subscriptionStart).toLocaleDateString("en-ZA")} ({subscriptionDays}d)</p>
            )}
            <p className="text-xs text-muted-foreground">Resets the subscription timer and restores credits to {creditsMonthly}.</p>
          </div>
          <form onSubmit={renewSubscription} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subscription Days</label>
              <Input value={days} onChange={e => setDays(e.target.value)} type="number" min="1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Activate / Renew"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Credits dialog (top-up only) ── */}
      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits — {businessName}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Current balance:</span>{" "}
              <span className={creditsRemaining <= 10 ? "text-destructive font-semibold" : "font-semibold"}>
                {creditsRemaining}
              </span>
              <span className="text-muted-foreground"> / {creditsMonthly}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Does not affect subscription dates.</p>
          </div>
          <form onSubmit={addCredits} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPack(50)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${selectedPack === 50 ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
              >
                <p className="text-sm font-bold">Small Pack</p>
                <p className="text-xs text-muted-foreground mt-0.5">50 credits</p>
                <p className="text-lg font-bold text-primary mt-1">R400</p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPack(100)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${selectedPack === 100 ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
              >
                <p className="text-sm font-bold">Full Refill</p>
                <p className="text-xs text-muted-foreground mt-0.5">100 credits</p>
                <p className="text-lg font-bold text-primary mt-1">R799</p>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Added to existing balance, capped at 100. Subscription dates unchanged.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreditsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Adding..." : `Add ${selectedPack} Credits`}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
