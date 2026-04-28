import { createClient } from "@/lib/supabase/server";
import { AddClientModal } from "@/components/dashboard/add-client-modal";
import { ClientsTable } from "@/components/dashboard/clients-table";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .single();

  const { data: clients } = business
    ? await supabase
        .from("clients")
        .select("id, name, email, phone, reference_number, is_active")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("name")
    : { data: [] };

  const clientCount = (clients ?? []).length;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Clients</h2>
          <p className="text-sm text-muted-foreground">{clientCount} of 20 clients</p>
        </div>
        <AddClientModal businessId={business?.id ?? ""} clientCount={clientCount} />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <ClientsTable clients={(clients ?? []) as any} businessId={business?.id ?? ""} />
      </div>
    </div>
  );
}
