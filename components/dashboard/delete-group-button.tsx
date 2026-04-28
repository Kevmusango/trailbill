"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DeleteGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/groups/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"${groupName}" deleted`);
        router.push("/dashboard/groups");
      } else {
        toast.error(data.error ?? "Failed to delete group");
        setDeleting(false);
        setConfirm(false);
      }
    } catch {
      toast.error("Failed to delete group");
      setDeleting(false);
      setConfirm(false);
    }
  };

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">Delete &quot;{groupName}&quot;?</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
          className="h-8 px-3 text-xs"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className="h-8 px-3 text-xs"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirm(true)}
      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
    >
      <Trash2 className="w-4 h-4" />
      Delete Group
    </Button>
  );
}
