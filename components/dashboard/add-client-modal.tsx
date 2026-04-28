"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";


export function AddClientModal({ businessId, clientCount = 0 }: { businessId: string; clientCount?: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientCount >= 20) {
      toast.error("You've reached the maximum of 20 clients");
      return;
    }
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!phone.trim() && !email.trim() && !smsNumber.trim()) {
      toast.error("Add at least one contact — WhatsApp, Email, or SMS");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("clients").insert({
      business_id: businessId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      sms_number: smsNumber.trim() || null,
      reference_number: refNumber.trim() || null,
      client_type: clientType,
    });

    if (error) {
      toast.error("Failed to add client");
      setLoading(false);
      return;
    }

    toast.success(`${name.trim()} added`);
    setName(""); setPhone(""); setEmail(""); setSmsNumber(""); setRefNumber("");
    setClientType("individual");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription>Add a new client to track payments.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Client Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(["individual", "business"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClientType(type)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    clientType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {type === "individual" ? "Individual" : "Business"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={clientType === "business" ? "e.g. Springfield Primary" : "e.g. John Smith"}
              autoFocus
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">At least one contact required <span className="text-destructive font-semibold">*</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">WhatsApp</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 072 123 4567" type="tel" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. john@email.co.za" type="email" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-sm font-medium mb-1 block">SMS Number <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
              <Input value={smsNumber} onChange={(e) => setSmsNumber(e.target.value)} placeholder="e.g. 072 123 4567" type="tel" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Reference Number <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              placeholder="e.g. CLT-001 or ACC-2045"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Matches your internal invoice/accounting reference</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
