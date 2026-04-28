import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/resend";
import { emailBase } from "@/lib/email-template";
import { sendWhatsAppTemplate, buildProposalSendMessage } from "@/lib/whatsapp";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

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

  const business = proposal.businesses as { name: string; logo_url: string | null } | null;
  if (!business) return NextResponse.json({ error: "No business found" }, { status: 400 });

  // Use admin client to fetch credit data — avoids any RLS edge cases
  const adminDb = createAdminClient();
  const { data: biz } = await adminDb
    .from("businesses")
    .select("credits_remaining, subscription_active, subscription_end")
    .eq("id", proposal.business_id)
    .single();

  if (!biz) {
    console.error("[proposal/send-email] could not fetch business:", proposal.business_id);
    return NextResponse.json({ error: "Business not found" }, { status: 400 });
  }

  const emailCost = 1;
  const waCost = 2;
  const creditCost = emailCost; // base cost for email; WhatsApp adds more if delivered
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
  if (!proposal.client_email) return NextResponse.json({ error: "Client has no email" }, { status: 400 });

  const businessName = business?.name ?? "Business";
  const proposalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com"}/proposal/${proposal.public_token}`;

  const body = `
    <p style="margin:0 0 14px;font-size:15px;color:#111827;">Hi <strong>${proposal.client_name}</strong> 👋</p>

    <p style="margin:0 0 18px;font-size:15px;color:#111827;line-height:1.6;">
      <strong>${businessName}</strong> has put together a proposal for you —
      <strong>${proposal.title}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#c2410c;">⏰ Offer expires ${fmtDate(proposal.expiry_date)}</p>
          <p style="margin:0;font-size:13px;color:#7c3a00;line-height:1.5;">After this date the offer may no longer be available. Confirm your spot before then.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
      Inside you'll find pricing, flexible payment options, and a chance to pick your preferred start date. It takes less than a minute.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr><td align="center">
        <a href="${proposalUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 44px;border-radius:10px;letter-spacing:0.01em;">
          View Proposal &rarr;
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Only you received this proposal. Replying to this email won&rsquo;t be seen &mdash; use the button above.</p>
  `;

  const html = emailBase({ title: "Proposal", subtitle: proposal.title, businessName, logoUrl: business?.logo_url ?? null, body });

  const { error } = await sendEmail({
    to: proposal.client_email,
    subject: `${proposal.client_name}, ${businessName} is waiting for your answer`,
    html,
  });

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });

  // Attempt WhatsApp API send and charge for it if successful
  let waSent = false;
  if (proposal.client_phone) {
    const msg = buildProposalSendMessage({
      publicToken: proposal.public_token,
      clientName: proposal.client_name,
      businessName,
      title: proposal.title,
    });
    const waResult = await sendWhatsAppTemplate({ toPhone: proposal.client_phone, ...msg }).catch(() => null);
    waSent = waResult?.sent === true;
  }

  // Record channels sent
  try { await adminDb.rpc("record_channel_sent", { p_proposal_id: proposalId, p_channel: "email" }); } catch {}
  if (waSent) { try { await adminDb.rpc("record_channel_sent", { p_proposal_id: proposalId, p_channel: "whatsapp" }); } catch {} }

  // Deduct actual credits: 1 for email + 2 more if WhatsApp was also delivered
  const creditsCharged = emailCost + (waSent ? waCost : 0);
  await adminDb
    .from("businesses")
    .update({ credits_remaining: currentCredits - creditsCharged })
    .eq("id", proposal.business_id)
    .gte("credits_remaining", creditsCharged);

  revalidatePath("/dashboard", "layout");

  return NextResponse.json({ success: true, creditsUsed: creditsCharged, creditsRemaining: currentCredits - creditsCharged });
}
