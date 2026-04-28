"use client";

import { useState } from "react";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MarkPaidModal } from "@/components/dashboard/mark-paid-modal";
import { EditRequestModal } from "@/components/dashboard/edit-request-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PaymentActionsProps {
  requestId: string;
  clientId: string;
  clientName: string;
  totalDue: number;
  outstanding: number;
  baseAmount: number;
  dueDate: string;
  graceEndDate: string | null;
  scheduledAt: string | null;
  description: string | null;
  customNote: string | null;
  status: string;
}

export function PaymentActions({ requestId, clientId, clientName, totalDue, outstanding, baseAmount, dueDate, graceEndDate, scheduledAt, description, customNote, status }: PaymentActionsProps) {
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/payments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payment request deleted");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
    setDeleting(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      {status !== "paid" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditOpen(true)}
          className="text-xs h-8 w-8 p-0"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDeleteOpen(true)}
        className="text-xs h-8 w-8 p-0 text-destructive hover:text-destructive"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      <Button
        size="sm"
        variant={status === "paid" ? "ghost" : "outline"}
        onClick={() => setMarkPaidOpen(true)}
        className="text-xs h-8"
      >
        {status === "paid" ? "Record Payment" : "Mark Paid"}
      </Button>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="gap-3 max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Delete Request</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to delete the payment request for <span className="font-medium text-foreground">{clientName}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="px-1 pb-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Deleting…</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-destructive rounded-full w-2/5"
                  style={{ animation: "deletion-slide 1.4s ease-in-out infinite" }} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting} className="flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkPaidModal
        requestId={requestId}
        clientId={clientId}
        clientName={clientName}
        totalDue={totalDue}
        outstanding={outstanding}
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
      />
      <EditRequestModal
        requestId={requestId}
        clientName={clientName}
        baseAmount={baseAmount}
        graceEndDate={graceEndDate}
        dueDate={dueDate}
        scheduledAt={scheduledAt}
        description={description}
        customNote={customNote}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
