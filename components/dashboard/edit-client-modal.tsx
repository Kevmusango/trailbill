"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    sms_number?: string | null;
    reference_number: string | null;
    client_type?: string | null;
  };
}

export function EditClientModal({ client }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [smsNumber, setSmsNumber] = useState(client.sms_number ?? "");
  const [refNumber, setRefNumber] = useState(client.reference_number ?? "");
  const [clientType, setClientType] = useState<"individual" | "business">(
    (client.client_type as "individual" | "business") ?? "individual"
  );
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName(client.name);
      setPhone(client.phone ?? "");
      setEmail(client.email ?? "");
      setSmsNumber(client.sms_number ?? "");
      setRefNumber(client.reference_number ?? "");
      setClientType((client.client_type as "individual" | "business") ?? "individual");
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Client name is required"); return; }
    if (!phone.trim() && !email.trim() && !smsNumber.trim()) { toast.error("Add at least one contact — WhatsApp, Email, or SMS"); return; }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        sms_number: smsNumber.trim() || null,
        reference_number: refNumber.trim() || null,
        client_type: clientType,
      })
      .eq("id", client.id);

    if (error) {
      toast.error("Failed to update client");
      setLoading(false);
      return;
    }

    toast.success(`${name.trim()} updated`);
    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
        title="Edit client"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update details for {client.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Client Type</label>
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
                placeholder="Client name"
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
              <label className="text-sm font-medium mb-1 block">
                Reference Number <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                placeholder="e.g. CLT-001 or ACC-2045"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
