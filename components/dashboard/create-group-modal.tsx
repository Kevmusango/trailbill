"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CreateGroupModal({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [name, setName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [graceDays, setGraceDays] = useState("0");
  const [lateFeePct, setLateFeePct] = useState("0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Group name is required"); return; }
    if (!defaultAmount || Number(defaultAmount) <= 0) { toast.error("Default amount must be greater than 0"); return; }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("client_groups").insert({
      business_id: businessId,
      name: name.trim(),
      default_amount: Number(defaultAmount),
      due_day: Number(dueDay),
      grace_days: Number(graceDays),
      late_fee_pct: Number(lateFeePct),
      active_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    });

    if (error) {
      toast.error("Failed to create group");
      setLoading(false);
      return;
    }

    toast.success(`${name.trim()} group created`);
    setOpen(false);
    setLoading(false);
    setName(""); setDefaultAmount(""); setDueDay("1"); setGraceDays("0"); setLateFeePct("0");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FolderPlus className="w-4 h-4" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Group clients together for batch payment requests.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Group Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Primary Schools" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Default Amount (R) *</label>
              <Input value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} placeholder="e.g. 2500" type="number" min="0" step="0.01" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground mt-1">Amount each client pays per month</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due Day</label>
              <Input value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="e.g. 1" type="number" min="1" max="28" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground mt-1">Day of the month payment is due (1–28)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grace Period (days)</label>
              <Input value={graceDays} onChange={e => setGraceDays(e.target.value)} placeholder="e.g. 3" type="number" min="0" max="30" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground mt-1">Extra days before late fee applies</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Late Fee (%)</label>
              <Input value={lateFeePct} onChange={e => setLateFeePct(e.target.value)} placeholder="e.g. 5" type="number" min="0" max="100" step="0.1" className="h-8 text-sm" />
              <p className="text-[11px] text-muted-foreground mt-1">% added after grace period ends</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Group"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
