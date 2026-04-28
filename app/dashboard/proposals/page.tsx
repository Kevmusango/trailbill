import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProposalsList } from "@/components/dashboard/proposals-list";

export default async function ProposalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, credits_remaining, credits_monthly, subscription_active, email_notifications, whatsapp_notifications, sms_notifications")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/dashboard");

  const { data: proposals } = await supabase
    .from("proposals")
    .select(`
      id, title, client_id, client_name, client_email, client_phone, amount, status, expiry_date, public_token, created_at, allow_counter, min_counter_amount, channels_sent, viewed_at, view_count,
      proposal_responses(start_date, start_month_only, selected_payment_term, counter_amount, counter_note, project_started_at, responded_at)
    `)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name");

  const isExpired = !business.subscription_active;

  return (
    <ProposalsList
      proposals={proposals ?? []}
      clients={clients ?? []}
      creditsRemaining={business.credits_remaining ?? 0}
      creditsMonthly={business.credits_monthly ?? 100}
      subscriptionActive={business.subscription_active ?? false}
      isExpired={isExpired ?? false}
      enabledEmail={(business as any).email_notifications !== false}
      enabledWhatsApp={(business as any).whatsapp_notifications !== false}
      enabledSMS={(business as any).sms_notifications === true}
    />
  );
}
