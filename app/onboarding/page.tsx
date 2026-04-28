import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, onboarding_completed")
    .eq("owner_id", user.id)
    .single();

  if (business?.onboarding_completed) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <OnboardingWizard businessId={business?.id ?? ""} businessName={business?.name ?? ""} />
    </div>
  );
}
