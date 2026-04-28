import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { GroupMemberList } from "@/components/dashboard/group-member-list";
import { AddMemberModal } from "@/components/dashboard/add-member-modal";
import { EditGroupModal } from "@/components/dashboard/edit-group-modal";
import { DeleteGroupButton } from "@/components/dashboard/delete-group-button";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .single();

  const { data: group } = await supabase
    .from("client_groups")
    .select("*")
    .eq("id", id)
    .eq("business_id", business?.id ?? "")
    .single();

  if (!group) return notFound();

  const { data: members } = await supabase
    .from("group_memberships")
    .select("*, clients(*)")
    .eq("group_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const memberClientIds = (members ?? []).map((m) => (m.clients as { id: string })?.id).filter(Boolean);

  const { data: availableClients } = await supabase
    .from("clients")
    .select("id, name, email, phone")
    .eq("business_id", business?.id ?? "")
    .eq("is_active", true)
    .order("name");

  const filteredAvailable = (availableClients ?? []).filter(c => !memberClientIds.includes(c.id));

  return (
    <div className="p-4 lg:p-8">
      <Link href="/dashboard/groups" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Groups
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">{group.name}</h2>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {group.name !== "Individual" && (
            <DeleteGroupButton groupId={group.id} groupName={group.name} />
          )}
          <EditGroupModal group={group} />
          <AddMemberModal groupId={id} availableClients={filteredAvailable} defaultAmount={group.default_amount} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Default Amount</p>
          <p className="text-xl font-bold text-primary">R{Number(group.default_amount).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" />
            Due Day
          </div>
          <p className="text-xl font-bold">{group.due_day}{
            group.due_day === 1 ? "st" : group.due_day === 2 ? "nd" : group.due_day === 3 ? "rd" : "th"
          } <span className="text-sm font-normal text-muted-foreground">of each month</span></p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" />
            Grace Period
          </div>
          <p className="text-xl font-bold">{group.grace_days ?? 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Late Fee</p>
          <p className="text-xl font-bold">{group.late_fee_pct ?? 0}<span className="text-sm font-normal text-muted-foreground">%</span></p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Users className="w-3.5 h-3.5" />
            Members
          </div>
          <p className="text-xl font-bold">{(members ?? []).length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-base font-semibold">Members ({(members ?? []).length})</h3>
        </div>
        <GroupMemberList
          members={(members ?? []).map(m => ({
            id: m.id,
            groupId: id,
            clientId: (m.clients as { id: string })?.id ?? "",
            clientName: (m.clients as { name: string })?.name ?? "Unknown",
            clientPhone: (m.clients as { phone: string | null })?.phone ?? null,
            clientEmail: (m.clients as { email: string | null })?.email ?? null,
            customAmount: m.custom_amount,
            customNote: m.custom_note,
            defaultAmount: group.default_amount,
            runningBalance: 0,
            status: "good",
          }))}
        />
      </div>
    </div>
  );
}
