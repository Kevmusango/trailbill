import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PaymentPageClient } from "@/components/pay/payment-page-client";
import { normalizeLogoUrl } from "@/lib/utils";

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ action?: string }> }) {
  const { token } = await params;
  const { action } = await searchParams;
  const supabase = await createClient();

  // Fetch payment request with business info
  const { data: request } = await supabase
    .from("payment_requests")
    .select("*, clients(name, phone), businesses:business_id(name, logo_url, bank_name, account_number, branch_code, account_type)")
    .eq("public_token", token)
    .single();

  if (!request) return notFound();

  // Track link open + log behavioural event (fire-and-forget)
  await Promise.all([
    supabase.rpc("track_link_open", { p_token: token }),
    supabase.rpc("log_payment_event", {
      p_request_id:    request.id,
      p_event_type:    "link_visited",
      p_channel:       null,
      p_reminder_type: null,
      p_metadata:      {},
    }),
  ]);

  const client = request.clients as { name: string; phone: string | null } | null;
  const business = request.businesses as {
    name: string;
    logo_url: string | null;
    bank_name: string | null;
    account_number: string | null;
    branch_code: string | null;
    account_type: string | null;
  } | null;

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-3">
      <PaymentPageClient
        token={token}
        businessName={business?.name ?? "Business"}
        businessLogo={normalizeLogoUrl(business?.logo_url)}
        clientName={client?.name ?? "Client"}
        requestNumber={request.request_number}
        description={request.description ?? ""}
        totalDue={Number(request.total_due)}
        baseAmount={Number(request.base_amount)}
        previousBalance={Number(request.previous_balance)}
        dueDate={request.due_date}
        graceEndDate={request.grace_end_date}
        committedDate={request.committed_date}
        extraDaysRequested={request.extra_days_requested}
        lateFee={Number(request.late_fee_pct)}
        finalDueDate={request.final_due_date ?? null}
        status={request.status}
        bankName={business?.bank_name ?? null}
        accountNumber={business?.account_number ?? null}
        branchCode={business?.branch_code ?? null}
        accountType={business?.account_type ?? null}
        initialAction={action === "extra" ? "extra" : action === "pay" ? "pay" : null}
      />
    </div>
  );
}
