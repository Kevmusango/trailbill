import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarDays, Activity } from "lucide-react";
import { CashFlowCalendar } from "@/components/dashboard/cash-flow-calendar";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/dashboard");

  const businessId = business.id;

  // ALL payment requests — no date filter, full history
  const { data: allRequests } = await supabase
    .from("payment_requests")
    .select("id, total_due, outstanding, status, due_date, committed_date, created_at, clients(name), payment_batches(scheduled_at)")
    .eq("business_id", businessId)
    .order("due_date", { ascending: false });

  // ALL payments received — full history
  const { data: receivedPayments } = await supabase
    .from("payments")
    .select("id, amount, payment_date, clients(name)")
    .eq("business_id", businessId)
    .order("payment_date", { ascending: false });

  // ALL sent reminders — full history
  const { data: sentReminders } = await supabase
    .from("reminder_log")
    .select("id, reminder_type, sent_at, channel, status, payment_requests(id, total_due, clients(name))")
    .eq("business_id", businessId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  // Groups — contract view per month
  const { data: groups } = await supabase
    .from("client_groups")
    .select("id, name, default_amount, due_day, active_months, is_active")
    .eq("business_id", businessId)
    .neq("name", "Individual")
    .order("name");

  // Accepted proposals with confirmed start dates
  const { data: acceptedProposals } = await supabase
    .from("proposals")
    .select("id, title, client_name, amount, proposal_responses(id, start_date, start_month_only)")
    .eq("business_id", businessId)
    .in("status", ["accepted", "owner_revised"]);

  return (
    <div className="px-4 pt-3 pb-4 lg:px-6 lg:pt-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary shrink-0" />
        <h2 className="text-lg font-bold">Calendar &amp; Activity</h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        {/* Left: Cash flow calendar */}
        <div className="w-full xl:flex-1 min-w-0">
        <CashFlowCalendar
          events={(allRequests ?? []).map(r => {
            const client = r.clients as unknown as { name: string } | null;
            const batchScheduledAt = (r.payment_batches as unknown as { scheduled_at: string | null } | null)?.scheduled_at ?? null;
            return {
              id: r.id,
              clientName: client?.name ?? "Unknown",
              amount: Number(r.total_due),
              outstanding: Number(r.outstanding),
              dueDate: r.due_date,
              committedDate: r.committed_date,
              scheduledAt: r.status === "scheduled" ? batchScheduledAt : null,
              sentAt: r.status !== "scheduled" ? (batchScheduledAt ?? r.created_at) : null,
              status: r.status,
            };
          })}
          receivedPayments={(receivedPayments ?? []).map(p => {
            const client = p.clients as unknown as { name: string } | null;
            return {
              id: p.id,
              clientName: client?.name ?? "Unknown",
              amount: Number(p.amount),
              paidAt: p.payment_date,
            };
          })}
          sentReminders={(sentReminders ?? []).map((r: any) => {
            const pr = r.payment_requests as { id: string; total_due: number; clients: { name: string } | null } | null;
            return {
              id: r.id,
              clientName: (pr?.clients as { name: string } | null)?.name ?? "Unknown",
              amount: Number(pr?.total_due ?? 0),
              sentAt: r.sent_at,
              reminderType: r.reminder_type as string,
              channel: r.channel as string,
            };
          })}
          proposalStarts={(acceptedProposals ?? []).flatMap(p => {
            const resp = (p.proposal_responses as { id: string; start_date: string; start_month_only: boolean }[] | null)?.[0];
            if (!resp?.start_date) return [];
            return [{
              id: resp.id,
              clientName: p.client_name,
              proposalTitle: p.title,
              amount: Number(p.amount),
              startDate: resp.start_date,
              startMonthOnly: resp.start_month_only ?? false,
            }];
          })}
        groups={(groups ?? []).map(g => ({
            id: g.id,
            name: g.name,
            defaultAmount: Number(g.default_amount),
            dueDay: Number(g.due_day),
            activeMonths: (g.active_months ?? []) as number[],
            isActive: g.is_active as boolean,
          }))}
        />
        </div>

        {/* Right: Activity timeline */}
        <div className="w-full xl:w-96 shrink-0">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Today&apos;s Activity</h3>
            </div>
            <ActivityTimeline businessId={business.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
