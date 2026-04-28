"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AddLeadModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Name, email, and phone are required");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("leads").insert({
      full_name: fullName.trim(),
      business_name: businessName.trim() || null,
      email: email.trim(),
      phone: phone.trim(),
    });

    if (error) {
      toast.error("Failed to add lead");
      setLoading(false);
      return;
    }

    toast.success(`Lead "${fullName.trim()}" added`);
    setFullName("");
    setBusinessName("");
    setEmail("");
    setPhone("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription>Manually add a new lead to the pipeline</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name *</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Business Name</label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Smith Catering" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="jane@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone *</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="072 123 4567" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
