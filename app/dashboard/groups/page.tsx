import { FolderOpen, Users, Calendar, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateGroupModal } from "@/components/dashboard/create-group-modal";
import { DeleteGroupButton } from "@/components/dashboard/delete-group-button";
import Link from "next/link";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .single();

  const { data: groups } = business
    ? await supabase
        .from("client_groups")
        .select("id, name, default_amount, due_day, group_memberships(id, is_active)")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .neq("name", "Individual")
        .order("name")
    : { data: [] };

  const groupsWithCount = (groups || []).map((group: Record<string, unknown>) => ({
    ...group,
    client_count: (group.group_memberships as { is_active: boolean }[] | null)?.filter(m => m.is_active).length ?? 0,
  }));

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Groups</h2>
          <p className="text-sm text-muted-foreground">Organize clients for batch payment requests</p>
        </div>
        <CreateGroupModal businessId={business?.id ?? ""} />
      </div>

      {groupsWithCount.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupsWithCount.map((group: Record<string, unknown>) => {
            const dueDay = group.due_day as number;
            const ordinal = dueDay === 1 ? "st" : dueDay === 2 ? "nd" : dueDay === 3 ? "rd" : "th";
            return (
              <div
                key={group.id as string}
                className="bg-card rounded-xl border border-border hover:shadow-md hover:border-primary/30 transition-all flex flex-col"
              >
                <Link href={`/dashboard/groups/${group.id}`} className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-base truncate">{group.name as string}</h3>
                    <FolderOpen className="w-5 h-5 text-primary flex-shrink-0 ml-3" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{group.client_count as number} client{(group.client_count as number) !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-4 h-4" />
                      <span className="font-semibold text-primary">R{Number(group.default_amount).toLocaleString("en-ZA")}</span>
                      <span className="text-muted-foreground">/ month</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Due on the {dueDay}{ordinal}</span>
                    </div>
                  </div>
                </Link>
                <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
                  {(group.client_count as number) > 0 ? (
                    <Link
                      href={`/dashboard/payments/send?group=${group.id}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground opacity-30 cursor-not-allowed select-none">
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </span>
                  )}
                  <DeleteGroupButton groupId={group.id as string} groupName={group.name as string} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6">Create your first group to send batch payment requests</p>
          <CreateGroupModal businessId={business?.id ?? ""} />
        </div>
      )}
    </div>
  );
}
