"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AddBusinessModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [subscriptionDays, setSubscriptionDays] = useState("30");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/convert-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: null,
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          businessName: businessName.trim() || fullName.trim(),
          subscriptionDays: Number(subscriptionDays),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to create business");
        setLoading(false);
        return;
      }

      toast.success(`Business created! Credentials: ${email.trim()} / ${password}`);
      setFullName("");
      setEmail("");
      setBusinessName("");
      setPassword("");
      setSubscriptionDays("30");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create business");
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Building2 className="w-4 h-4" />
          Add Business
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Business</DialogTitle>
          <DialogDescription>Create a new business account directly</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Owner Name *</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Business Name</label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="JD Transport" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email *</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="owner@business.co.za" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Temp Password *</label>
              <Input value={password} onChange={e => setPassword(e.target.value)} type="text" placeholder="Min 6 chars" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subscription Days</label>
              <Input value={subscriptionDays} onChange={e => setSubscriptionDays(e.target.value)} type="number" min="1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Business"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
