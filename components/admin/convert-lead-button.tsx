"use client";

import { useState } from "react";
import { UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ConvertLeadButtonProps {
  leadId: string;
  fullName: string;
  email: string;
  businessName: string | null;
  businessType?: string | null;
  phone?: string | null;
  createdAt?: string | null;
}

export function ConvertLeadButton({ leadId, fullName, email, businessName, businessType, phone, createdAt }: ConvertLeadButtonProps) {
  const [open, setOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const router = useRouter();

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);

    try {
      // Call API route to create auth user (needs service role key)
      const res = await fetch("/api/admin/convert-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, email, password, fullName, businessName }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to convert lead");
        setLoading(false);
        return;
      }

      toast.success(`${fullName} converted to business. Credentials: ${email} / ${password}`);
      setOpen(false);
      setLoading(false);
      router.refresh();
    } catch {
      toast.error("Failed to convert lead");
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setRejectLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ status: "rejected" }).eq("id", leadId);
    if (error) { toast.error("Failed to reject"); setRejectLoading(false); return; }
    toast.success(`${fullName} rejected`);
    setRejectOpen(false);
    setRejectLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setOpen(true)}>
        <UserCheck className="w-3.5 h-3.5" />
        Convert
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive" onClick={() => setRejectOpen(true)}>
        <XCircle className="w-3.5 h-3.5" />
        Reject
      </Button>

      {/* ── Reject confirmation ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this lead?</DialogTitle>
            <DialogDescription>This will move the lead to the processed list as rejected.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {fullName}</p>
            <p><span className="text-muted-foreground">Email:</span> {email}</p>
            {(businessName ?? businessType) && (
              <p><span className="text-muted-foreground">Business:</span> {businessName ?? businessType}</p>
            )}
            {phone && <p><span className="text-muted-foreground">Phone:</span> {phone}</p>}
            {createdAt && (
              <p><span className="text-muted-foreground">Submitted:</span> {new Date(createdAt).toLocaleDateString("en-ZA")}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={rejectLoading}>
              {rejectLoading ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Business</DialogTitle>
            <DialogDescription>Create an account for {fullName} ({email})</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {fullName}</p>
              <p><span className="text-muted-foreground">Email:</span> {email}</p>
              {businessName && <p><span className="text-muted-foreground">Business:</span> {businessName}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Temporary Password *</label>
              <Input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="text"
                placeholder="Enter a temporary password"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">User will be prompted to change this on first login</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Converting..." : "Create Account"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
