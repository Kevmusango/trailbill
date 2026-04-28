"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AvailableClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface AddMemberModalProps {
  groupId: string;
  availableClients: AvailableClient[];
  defaultAmount: number;
}

export function AddMemberModal({ groupId, availableClients, defaultAmount }: AddMemberModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customNote, setCustomNote] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) { toast.error("Select a client"); return; }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("group_memberships").insert({
      group_id: groupId,
      client_id: selectedClient,
      custom_amount: customAmount ? Number(customAmount) : null,
      custom_note: customNote.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("This client is already in this group");
      } else {
        toast.error("Failed to add member");
      }
      setLoading(false);
      return;
    }

    const clientName = availableClients.find(c => c.id === selectedClient)?.name ?? "Client";
    toast.success(`${clientName} added to group`);
    setSelectedClient("");
    setCustomAmount("");
    setCustomNote("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member to Group</DialogTitle>
          <DialogDescription>
            Default amount: R{defaultAmount.toLocaleString()}. Set a custom amount to override.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Select Client *</label>
            {availableClients.length > 0 ? (
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a client...</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                All clients are already in this group. Add new clients first.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Custom Amount (optional)</label>
            <Input
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder={`Default: R${defaultAmount.toLocaleString()}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Note (optional)</label>
            <Input
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="e.g. Special arrangement — pays quarterly"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !selectedClient}>
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
