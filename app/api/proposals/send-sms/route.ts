import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sendSMS, smsProposalSend } from "@/lib/sms";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await req.json();
  if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, businesses:business_id(name, logo_url)")
    .eq("id", proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (!proposal.client_phone) return NextResponse.json({ error: "Client has no phone number" }, { status: 400 });

  const business = proposal.businesses as { name: string; logo_url: string | null } | null;
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 400 });

  const adminDb = createAdminClient();
  const { data: biz } = await adminDb
    .from("businesses")
    .select("credits_remaining, subscription_active, subscription_end")
    .eq("id", proposal.business_id)
    .single();

  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 400 });

  const creditCost = 2;
  const currentCredits = biz.credits_remaining ?? 0;
  const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  if (!biz.subscription_active) {
    return NextResponse.json({ error: "Subscription inactive — contact support to activate" }, { status: 403 });
  }
  if (biz.subscription_end && biz.subscription_end <= todayDate) {
    return NextResponse.json({ error: "Subscription expired — contact support to renew" }, { status: 403 });
  }
  if (currentCredits < creditCost) {
    return NextResponse.json({ error: `Insufficient credits — need ${creditCost}, have ${currentCredits}` }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com";
  const proposalUrl = `${appUrl}/proposal/${proposal.public_token}`;

  const message = smsProposalSend({
    clientName: proposal.client_name,
    businessName: business.name ?? "Business",
    title: proposal.title,
    url: proposalUrl,
  });

  const result = await sendSMS({ to: proposal.client_phone, message });

  const creditsCharged = result.sent ? creditCost : 0;

  if (result.sent) {
    try { await adminDb.rpc("record_channel_sent", { p_proposal_id: proposalId, p_channel: "sms" }); } catch {}
  }

  if (creditsCharged > 0) {
    await adminDb
      .from("businesses")
      .update({ credits_remaining: currentCredits - creditsCharged })
      .eq("id", proposal.business_id)
      .gte("credits_remaining", creditsCharged);

    revalidatePath("/dashboard", "layout");
  }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    skipped: result.skipped,
    reason: result.reason,
    creditsUsed: creditsCharged,
    creditsRemaining: currentCredits - creditsCharged,
  });
}
