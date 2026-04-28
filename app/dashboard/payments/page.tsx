import { Send } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaymentsTable } from "@/components/dashboard/payments-table";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, subscription_active")
    .eq("owner_id", user?.id ?? "")
    .single();

  const businessId = business?.id ?? "";
  const isExpired = !(business?.subscription_active ?? true);

  const { data: requests } = businessId
    ? await supabase
        .from("payment_requests")
        .select("id, request_number, total_due, amount_paid, outstanding, status, due_date, committed_date, committed_amount, extra_days_requested, late_fee_pct, grace_end_date, final_due_date, description, needs_attention, created_at, client_id, notification_channels, channels_sent, clients(name, phone)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Auto-mark overdue
  if (businessId && requests) {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const overdueIds = requests
      .filter((r: any) => ["sent", "opened", "partial"].includes(r.status) && r.due_date < todayStr)
      .map((r: any) => r.id);
    if (overdueIds.length > 0) {
      await supabase.from("payment_requests").update({ status: "overdue" }).in("id", overdueIds);
      overdueIds.forEach((id: string) => {
        const r = requests.find((x: any) => x.id === id) as any;
        if (r) r.status = "overdue";
      });
    }
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Payments</h2>
          <p className="text-sm text-muted-foreground">Track and manage payment requests</p>
        </div>
        {isExpired ? (
          <button disabled className="inline-flex items-center gap-2 bg-primary text-primary-foreground opacity-40 cursor-not-allowed rounded-lg text-sm font-medium px-5 h-11 min-h-[44px]">
            <Send className="w-4 h-4" />
            Send Requests
          </button>
        ) : (
          <Link
            href="/dashboard/payments/send"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-lg text-sm font-medium px-5 h-11 min-h-[44px] transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Requests
          </Link>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <PaymentsTable requests={(requests ?? []) as any} businessId={businessId} />
      </div>
    </div>
  );
}
