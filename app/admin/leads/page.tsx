import { UserPlus, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ConvertLeadButton } from "@/components/admin/convert-lead-button";
import { AddLeadModal } from "@/components/admin/add-lead-modal";

export default async function AdminLeadsPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  const pending = (leads ?? []).filter(l => l.status === "pending");
  const processed = (leads ?? []).filter(l => l.status !== "pending");

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Leads</h2>
          <p className="text-sm text-muted-foreground">Review interest form submissions and convert to businesses</p>
        </div>
        <AddLeadModal />
      </div>

      {/* Pending */}
      <div className="mb-8">
        <h3 className="text-base font-semibold mb-3">Pending ({pending.length})</h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {pending.length > 0 ? (
            <div className="divide-y divide-border">
              {pending.map((lead) => (
                <div key={lead.id} className="px-4 py-3 flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate">{lead.full_name ?? lead.name}</h4>
                    {(lead.business_name ?? lead.business_type) && (
                      <p className="text-xs text-muted-foreground truncate">{lead.business_name ?? lead.business_type}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <ConvertLeadButton
                      leadId={lead.id}
                      fullName={lead.full_name ?? lead.name}
                      email={lead.email}
                      businessName={lead.business_name}
                      businessType={lead.business_type}
                      phone={lead.phone}
                      createdAt={lead.created_at}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Inbox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No pending leads</p>
            </div>
          )}
        </div>
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3">Processed ({processed.length})</h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {processed.map((lead) => (
                <div key={lead.id} className="px-4 py-3 flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{lead.full_name ?? lead.name}</h4>
                    {(lead.business_name ?? lead.business_type) && (
                      <p className="text-xs text-muted-foreground truncate">{lead.business_name ?? lead.business_type}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                  <Badge
                    variant={lead.status === "approved" ? "success" : "destructive"}
                    className="text-[10px] flex-shrink-0"
                  >
                    {lead.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
