import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ReviewPageClient } from "@/components/proposal/review-page-client";
import { normalizeLogoUrl } from "@/lib/utils";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: response } = await admin
    .from("proposal_responses")
    .select(`
      id, review_token, owner_action, revised_amount, revised_note,
      start_date, start_month_only, selected_payment_term, counter_amount, counter_note,
      proposals:proposal_id (
        id, title, amount, public_token, client_name, client_email,
        businesses:business_id ( name, logo_url )
      )
    `)
    .eq("review_token", token)
    .single();

  if (!response || !response.counter_amount) return notFound();

  const proposal = response.proposals as any;
  const business = proposal?.businesses as any;

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-3">
      <ReviewPageClient
        reviewToken={token}
        businessName={business?.name ?? "Business"}
        businessLogo={normalizeLogoUrl(business?.logo_url)}
        clientName={proposal?.client_name ?? "Client"}
        proposalTitle={proposal?.title ?? ""}
        originalAmount={Number(proposal?.amount ?? 0)}
        counterAmount={Number(response.counter_amount)}
        counterNote={response.counter_note ?? null}
        selectedPaymentTerm={response.selected_payment_term ?? null}
        startDate={response.start_date}
        startMonthOnly={!!response.start_month_only}
        alreadyReviewed={!!response.owner_action}
        ownerAction={response.owner_action ?? null}
        revisedAmount={response.revised_amount ? Number(response.revised_amount) : null}
      />
    </div>
  );
}
