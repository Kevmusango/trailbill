import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SendRequestsFullPage } from "@/components/dashboard/send-requests-full-page";

export default async function SendPaymentRequestsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group: defaultGroupId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, credits_remaining, credits_monthly, subscription_active, email_notifications, whatsapp_notifications, sms_notifications")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/dashboard");

  const businessId = business.id;

  const { data: groups } = await supabase
    .from("client_groups")
    .select("id, name, default_amount, due_day")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");

  const { data: memberships } = await supabase
    .from("group_memberships")
    .select("group_id, custom_amount, clients(id, name)")
    .eq("is_active", true);

  const membersByGroup: Record<string, { clientId: string; clientName: string; defaultAmount: number }[]> = {};
  const groupDefaultAmounts: Record<string, number> = {};
  (groups ?? []).forEach(g => { groupDefaultAmounts[g.id] = Number(g.default_amount); });
  (memberships ?? []).forEach(m => {
    const client = m.clients as unknown as { id: string; name: string } | null;
    if (!client) return;
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
    membersByGroup[m.group_id].push({
      clientId: client.id,
      clientName: client.name,
      defaultAmount: m.custom_amount ? Number(m.custom_amount) : (groupDefaultAmounts[m.group_id] ?? 0),
    });
  });

  const { data: allBusinessClients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");

  const clientsInGroups = new Set<string>();
  Object.values(membersByGroup).forEach(members => {
    members.forEach(m => clientsInGroups.add(m.clientId));
  });

  const ungroupedClients = (allBusinessClients ?? [])
    .filter(c => !clientsInGroups.has(c.id))
    .map(c => ({ clientId: c.id, clientName: c.name, defaultAmount: 0 }));

  const groupsData = (groups ?? []).map(g => ({
    id: g.id,
    name: g.name,
    default_amount: Number(g.default_amount),
    due_day: Number(g.due_day ?? 1),
    members: membersByGroup[g.id] ?? [],
  }));

  return (
    <SendRequestsFullPage
      groups={groupsData}
      ungroupedClients={ungroupedClients}
      businessName={business.name}
      creditsRemaining={business.credits_remaining ?? 0}
      creditsMonthly={business.credits_monthly ?? 100}
      subscriptionActive={business.subscription_active ?? false}
      defaultGroupId={defaultGroupId}
      enabledEmail={(business as any).email_notifications !== false}
      enabledWhatsApp={(business as any).whatsapp_notifications !== false}
      enabledSMS={(business as any).sms_notifications === true}
    />
  );
}
