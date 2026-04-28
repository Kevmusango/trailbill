"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface RequestRefillModalProps {
  creditsRemaining: number;
  creditsMonthly: number;
  variant?: "link" | "button";
}

const PACKS = [
  { label: "Small Pack",   credits: 50,  price: "R400" },
  { label: "Full Refill",  credits: 100, price: "R799" },
];

export function RequestRefillModal({ creditsRemaining, creditsMonthly, variant = "link" }: RequestRefillModalProps) {
  const [open, setOpen]               = useState(false);
  const [selectedPack, setSelectedPack] = useState(0);
  const [phone, setPhone]             = useState("");
  const [message, setMessage]         = useState("");
  const [loading, setLoading]         = useState(false);

  const pack = PACKS[selectedPack];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) { toast.error("Please enter a contact number"); return; }
    setLoading(true);

    const res = await fetch("/api/refill-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pack:         pack.label,
        credits:      pack.credits,
        price:        pack.price,
        contactPhone: phone.trim(),
        message:      message.trim(),
      }),
    });

    if (!res.ok) {
      toast.error("Failed to send request. Try again.");
      setLoading(false);
      return;
    }

    toast.success("Refill request sent! We'll be in touch shortly.");
    setOpen(false);
    setPhone("");
    setMessage("");
    setLoading(false);
  };

  return (
    <>
      {variant === "button" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <Zap className="w-3 h-3" />
          Buy Now
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline font-medium"
        >
          Request Refill
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Credit Refill</DialogTitle>
          </DialogHeader>

          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              Current balance:{" "}
              <span className={creditsRemaining <= 10 ? "text-destructive font-semibold" : "font-semibold"}>
                {creditsRemaining}
              </span>
              <span className="text-muted-foreground"> / {creditsMonthly}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Pack</label>
              <div className="grid grid-cols-2 gap-3">
                {PACKS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPack(i)}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      selectedPack === i ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <p className="text-sm font-bold">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.credits} credits</p>
                    <p className="text-lg font-bold text-primary mt-1">{p.price}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Contact Number *</label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+27 82 000 0000"
                type="tel"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Message <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Best time to call, any notes..."
              />
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              Our team will contact you to process payment and add your credits.
            </p>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : `Request ${pack.label}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
