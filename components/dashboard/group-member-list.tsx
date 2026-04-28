"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface GroupMember {
  id: string;
  groupId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  customAmount: number | null;
  customNote: string | null;
  defaultAmount: number;
  runningBalance: number;
  status: string;
}

export function GroupMemberList({ members }: { members: GroupMember[] }) {
  const router = useRouter();

  const handleRemove = async (membershipId: string, clientName: string) => {
    if (!confirm(`Remove ${clientName} from this group?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("group_memberships")
      .update({ is_active: false })
      .eq("id", membershipId);

    if (error) {
      toast.error("Failed to remove member");
      return;
    }

    toast.success(`${clientName} removed from group`);
    router.refresh();
  };

  if (members.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">No members yet. Add clients to this group.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Client</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Amount</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Balance</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const amount = m.customAmount ?? m.defaultAmount;
              return (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{m.clientName}</p>
                    <p className="text-xs text-muted-foreground">{m.clientPhone || m.clientEmail || "No contact"}</p>
                    {m.customNote && <p className="text-xs text-amber-600 mt-0.5">{m.customNote}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold">R{Number(amount).toLocaleString()}</p>
                    {m.customAmount && (
                      <p className="text-[10px] text-amber-600">Custom</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${
                      m.runningBalance > 0 ? "text-destructive" :
                      m.runningBalance < 0 ? "text-emerald-600" : "text-foreground"
                    }`}>
                      {m.runningBalance < 0 ? "-" : ""}R{Math.abs(m.runningBalance).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={
                        m.status === "excellent" || m.status === "good" ? "success" :
                        m.status === "warning" ? "warning" : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {m.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(m.id, m.clientName)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {members.map(m => {
          const amount = m.customAmount ?? m.defaultAmount;
          return (
            <div key={m.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  R{Number(amount).toLocaleString()}{m.customAmount ? " (custom)" : ""}
                </p>
                {m.customNote && <p className="text-xs text-amber-600 truncate">{m.customNote}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant={
                    m.status === "excellent" || m.status === "good" ? "success" :
                    m.status === "warning" ? "warning" : "destructive"
                  }
                  className="text-[10px]"
                >
                  {m.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(m.id, m.clientName)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
