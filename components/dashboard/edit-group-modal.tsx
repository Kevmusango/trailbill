"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EditGroupModalProps {
  group: {
    id: string;
    name: string;
    default_amount: number;
    due_day: number;
    grace_days: number;
    late_fee_pct: number;
  };
}

export function EditGroupModal({ group }: EditGroupModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [name, setName] = useState(group.name);
  const [defaultAmount, setDefaultAmount] = useState(String(group.default_amount));
  const [dueDay, setDueDay] = useState(String(group.due_day));
  const [graceDays, setGraceDays] = useState(String(group.grace_days ?? 0));
  const [lateFeePct, setLateFeePct] = useState(String(group.late_fee_pct ?? 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Group name is required"); return; }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("client_groups").update({
      name: name.trim(),
      default_amount: Number(defaultAmount),
      due_day: Number(dueDay),
      grace_days: Number(graceDays),
      late_fee_pct: Number(lateFeePct),
      updated_at: new Date().toISOString(),
    }).eq("id", group.id);

    if (error) {
      toast.error("Failed to save changes");
      setLoading(false);
      return;
    }

    toast.success("Group updated");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Pencil className="w-4 h-4" />
          Edit Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>Update group settings.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Group Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Primary Schools" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Default Amount (R)</label>
              <Input value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} placeholder="e.g. 2500" type="number" min="0" step="0.01" />
              <p className="text-[11px] text-muted-foreground mt-1">Amount each client pays per month</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due Day</label>
              <Input value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="e.g. 1" type="number" min="1" max="28" />
              <p className="text-[11px] text-muted-foreground mt-1">Day of the month payment is due (1–28)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grace Period (days)</label>
              <Input value={graceDays} onChange={e => setGraceDays(e.target.value)} placeholder="e.g. 3" type="number" min="0" max="30" />
              <p className="text-[11px] text-muted-foreground mt-1">Extra days before late fee applies</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Late Fee (%)</label>
              <Input value={lateFeePct} onChange={e => setLateFeePct(e.target.value)} placeholder="e.g. 5" type="number" min="0" max="100" step="0.1" />
              <p className="text-[11px] text-muted-foreground mt-1">% added after grace period ends</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
