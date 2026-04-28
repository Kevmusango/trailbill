import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSubscriptionStatus } from "@/lib/subscription";
import { AlertTriangle } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Keep subscription_active accurate — flip to false if subscription_end has passed
  await supabase.rpc("expire_subscriptions");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, credits_remaining, credits_monthly, subscription_active, subscription_start, subscription_days")
    .eq("owner_id", user.id)
    .single();

  const userInitial = user.email?.[0]?.toUpperCase() ?? "U";
  const sub = getSubscriptionStatus(business?.subscription_start ?? null, business?.subscription_days ?? 30);
  const isExpired = !(business?.subscription_active ?? false) && sub.hasSubscription;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <DashboardSidebar
        businessName={business?.name}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          businessName={business?.name}
          creditsRemaining={business?.credits_remaining ?? 0}
          creditsMonthly={business?.credits_monthly ?? 100}
          subscriptionActive={business?.subscription_active ?? false}
          subscriptionStart={business?.subscription_start ?? null}
          subscriptionDays={business?.subscription_days ?? 30}
          userInitial={userInitial}
        />
        {isExpired && (
          <div className="flex items-start gap-3 bg-destructive/5 border-b border-destructive/20 px-4 lg:px-6 py-3">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-destructive">Your plan has expired. </span>
              Sending is paused — your existing reminders still run.{" "}
              <a href="mailto:support@trailbill.com" className="underline text-foreground">Contact support to renew.</a>
            </p>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
