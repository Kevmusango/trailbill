import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ProposalPageClient } from "@/components/proposal/proposal-page-client";
import { normalizeLogoUrl } from "@/lib/utils";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: proposal } = await admin
    .from("proposals")
    .select("*, businesses:business_id(name, logo_url)")
    .eq("public_token", token)
    .single();

  if (!proposal) return notFound();

  // Track view: sent→viewed on first open, increment view_count every open
  await admin.from("proposals").update({
    status: proposal.status === "sent" ? "viewed" : proposal.status,
    viewed_at: proposal.viewed_at ?? new Date().toISOString(),
    view_count: (proposal.view_count ?? 0) + 1,
  }).eq("public_token", token);

  // When owner sent back a final price, fetch it + the client's previous selections
  let revisedAmount: number | null = null;
  let revisedNote: string | null = null;
  let previousStartDate: string | null = null;
  let previousStartMonthOnly: boolean = false;
  let previousPaymentTerm: string | null = null;
  if (proposal.status === "owner_revised") {
    const { data: latestResponse } = await admin
      .from("proposal_responses")
      .select("revised_amount, revised_note, start_date, start_month_only, selected_payment_term")
      .eq("proposal_id", proposal.id)
      .eq("owner_action", "revised")
      .order("owner_reviewed_at", { ascending: false })
      .limit(1)
      .single();
    revisedAmount = latestResponse?.revised_amount ? Number(latestResponse.revised_amount) : null;
    revisedNote = latestResponse?.revised_note ?? null;
    previousStartDate = latestResponse?.start_date ?? null;
    previousStartMonthOnly = !!latestResponse?.start_month_only;
    previousPaymentTerm = latestResponse?.selected_payment_term ?? null;
  }

  const business = proposal.businesses as { name: string; logo_url: string | null } | null;

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-3">
      <ProposalPageClient
        token={token}
        businessName={business?.name ?? "Business"}
        businessLogo={normalizeLogoUrl(business?.logo_url)}
        clientName={proposal.client_name}
        title={proposal.title}
        description={proposal.description ?? null}
        amount={Number(proposal.amount)}
        paymentTerms={proposal.payment_terms ?? []}
        allowCounter={proposal.allow_counter}
        minCounterAmount={proposal.min_counter_amount ? Number(proposal.min_counter_amount) : null}
        expiryDate={proposal.expiry_date}
        status={proposal.status}
        revisedAmount={revisedAmount}
        revisedNote={revisedNote}
        previousStartDate={previousStartDate}
        previousStartMonthOnly={previousStartMonthOnly}
        previousPaymentTerm={previousPaymentTerm}
      />
    </div>
  );
}
