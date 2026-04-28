import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase } from "@/lib/email-template";
import { sendWhatsAppTemplate, buildProposalApprovedMessage, buildProposalFinalOfferMessage } from "@/lib/whatsapp";
import { sendSMS, smsProposalApproved, smsProposalFinalOffer } from "@/lib/sms";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fmtAmt(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

// GET /api/proposals/review?token=xxx  — fetch response details for owner review page
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: response } = await admin
    .from("proposal_responses")
    .select(`
      id, review_token, owner_action, revised_amount, revised_note, owner_reviewed_at,
      start_date, start_month_only, selected_payment_term, counter_amount, counter_note, responded_at,
      proposals:proposal_id (
        id, title, amount, public_token, client_name, client_email, client_phone, status, payment_terms,
        businesses:business_id ( name, logo_url, email, phone )
      )
    `)
    .eq("review_token", token)
    .single();

  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ response });
}

// POST /api/proposals/review  — owner approves or sets final price
export async function POST(req: Request) {
  const { token, action, revisedAmount, revisedNote } = await req.json();

  if (!token || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!["approved", "revised"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (action === "revised" && (!revisedAmount || Number(revisedAmount) <= 0)) {
    return NextResponse.json({ error: "Enter a valid final price" }, { status: 400 });
  }

  const { data: response } = await admin
    .from("proposal_responses")
    .select(`
      id, counter_amount, counter_note, start_date, start_month_only, selected_payment_term,
      proposals:proposal_id (
        id, title, amount, public_token, client_name, client_email, client_phone,
        businesses:business_id ( name, logo_url, email, phone )
      )
    `)
    .eq("review_token", token)
    .single();

  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((response as any).owner_action) return NextResponse.json({ error: "Already reviewed" }, { status: 400 });

  const proposal = response.proposals as any;
  const business = proposal?.businesses as any;
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com";
  const proposalUrl = `${appBase}/proposal/${proposal.public_token}`;

  // Save owner action
  await admin.from("proposal_responses").update({
    owner_action:      action,
    revised_amount:    action === "revised" ? Number(revisedAmount) : null,
    revised_note:      revisedNote?.trim() || null,
    owner_reviewed_at: new Date().toISOString(),
  }).eq("review_token", token);

  // Update proposal status
  const newStatus = action === "approved" ? "accepted" : "owner_revised";
  await admin.from("proposals").update({ status: newStatus }).eq("id", proposal.id);

  // Notify client
  try {
    if (action === "approved") {
      const counterAmt = fmtAmt(Number(response.counter_amount));
      const body = `
        <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${proposal.client_name}</strong> 👋</p>
        <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
          Great news! <strong>${business.name}</strong> has <strong>approved your counter offer</strong> of ${counterAmt} on <strong>${proposal.title}</strong>.
        </p>
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#166534;">✅ Your offer of <strong>${counterAmt}</strong> was accepted</p>
          <p style="margin:0 0 4px;font-size:13px;color:#166534;">📅 Start: <strong>${response.start_date}${response.start_month_only ? " (month)" : ""}</strong></p>
          <p style="margin:0;font-size:13px;color:#166534;">💳 Payment: <strong>${response.selected_payment_term ?? "—"}</strong></p>
        </div>
        <p style="font-size:13px;color:#374151;margin:0 0 20px;">${business.name} will be in touch to confirm next steps.</p>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Do not reply to this email.</p>
      `;
      const html = emailBase({ title: "Counter Accepted! 🎉", subtitle: proposal.title, businessName: business.name, logoUrl: business.logo_url ?? null, body });
      if (proposal.client_email) {
        await sendEmail({ to: proposal.client_email, subject: `✅ ${business.name} accepted your counter — ${proposal.title}`, html });
      }
      if (proposal.client_phone) {
        const msg = buildProposalApprovedMessage({
          clientName: proposal.client_name,
          businessName: business.name,
          title: proposal.title,
        });
        await sendWhatsAppTemplate({ toPhone: proposal.client_phone, ...msg }).catch(() => {});
      }
      // SMS to client
      if (proposal.client_phone) {
        const sms = smsProposalApproved({
          clientName: proposal.client_name,
          businessName: business.name,
          title: proposal.title,
        });
        await sendSMS({ to: proposal.client_phone, message: sms }).catch(() => {});
      }
    } else {
      // Owner revised — send client the final offer
      const finalAmt = fmtAmt(Number(revisedAmount));
      const origAsk = fmtAmt(Number(proposal.amount));
      const body = `
        <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${proposal.client_name}</strong> 👋</p>
        <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
          <strong>${business.name}</strong> reviewed your counter offer and has come back with a <strong>final price</strong> for <strong>${proposal.title}</strong>.
        </p>
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 18px;">
          <p style="margin:0 0 4px;font-size:13px;color:#1e40af;font-weight:700;">Final offer: ${finalAmt}</p>
          <p style="margin:0;font-size:12px;color:#3730a3;">Original ask was ${origAsk} · your counter was ${fmtAmt(Number(response.counter_amount))}</p>
          ${revisedNote ? `<p style="margin:6px 0 0;font-size:13px;color:#1e40af;">📝 "${revisedNote}"</p>` : ""}
        </div>
        <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">
          Open the proposal to accept this final price. This is their last offer.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
          <tr><td align="center">
            <a href="${proposalUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 44px;border-radius:10px;">
              View Final Offer &rarr;
            </a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Do not reply to this email.</p>
      `;
      const html = emailBase({ title: "Final Offer from " + business.name, subtitle: proposal.title, businessName: business.name, logoUrl: business.logo_url ?? null, body });
      if (proposal.client_email) {
        await sendEmail({ to: proposal.client_email, subject: `${business.name} has a final offer for you — ${proposal.title}`, html });
      }
      if (proposal.client_phone) {
        const msg = buildProposalFinalOfferMessage({
          publicToken: proposal.public_token,
          clientName: proposal.client_name,
          businessName: business.name,
          title: proposal.title,
        });
        await sendWhatsAppTemplate({ toPhone: proposal.client_phone, ...msg }).catch(() => {});
      }
      // SMS to client
      if (proposal.client_phone) {
        const sms = smsProposalFinalOffer({
          clientName: proposal.client_name,
          businessName: business.name,
          title: proposal.title,
          url: proposalUrl,
        });
        await sendSMS({ to: proposal.client_phone, message: sms }).catch(() => {});
      }
    }
  } catch {
    // Notification failure must not block the review action
  }

  return NextResponse.json({ success: true, status: newStatus });
}
