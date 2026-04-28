import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .single();

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold mb-1">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your business profile and banking details</p>
      </div>
      <SettingsForm business={business} />
    </div>
  );
}
