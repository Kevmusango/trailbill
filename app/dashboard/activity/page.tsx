import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Center</h1>
        <p className="text-sm text-muted-foreground">
          Today's reminders, scheduled sends, and upcoming activity
        </p>
      </div>

      <ActivityTimeline businessId={business.id} />
    </div>
  );
}
