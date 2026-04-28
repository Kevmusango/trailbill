import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase } from "@/lib/email-template";
import { sendWhatsAppTemplate, buildProposalCounterMessage, buildProposalApprovedMessage } from "@/lib/whatsapp";
import { sendSMS, smsProposalCounter } from "@/lib/sms";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { token, startDate, startMonthOnly, selectedPaymentTerm, counterAmount, counterNote } =
    await req.json();

  if (!token || !startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: proposal } = await admin
    .from("proposals")
    .select("id, status, expiry_date, allow_counter, min_counter_amount, title, client_name, client_email, client_phone, amount, business_id, public_token")
    .eq("public_token", token)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const today = new Date().toISOString().split("T")[0];
  if (proposal.expiry_date < today || proposal.status === "expired") {
    await admin.from("proposals").update({ status: "expired" }).eq("id", proposal.id);
    return NextResponse.json({ error: "Proposal has expired" }, { status: 400 });
  }

  if (proposal.status === "accepted") {
    return NextResponse.json({ error: "Proposal already accepted" }, { status: 400 });
  }

  const isCounter = !!counterAmount;

  if (isCounter) {
    if (!proposal.allow_counter) {
      return NextResponse.json({ error: "Counter offers not allowed" }, { status: 400 });
    }
    if (proposal.min_counter_amount && Number(counterAmount) < Number(proposal.min_counter_amount)) {
      return NextResponse.json({
        error: `Minimum acceptable amount is R${Number(proposal.min_counter_amount).toLocaleString("en-ZA")}`,
      }, { status: 400 });
    }
  }

  const { data: insertedResponse, error: insertError } = await admin
    .from("proposal_responses")
    .insert({
      proposal_id:           proposal.id,
      start_date:            startDate,
      start_month_only:      !!startMonthOnly,
      selected_payment_term: selectedPaymentTerm || null,
      counter_amount:        isCounter ? Number(counterAmount) : null,
      counter_note:          counterNote || null,
    })
    .select("review_token")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const newStatus = isCounter ? "revised_requested" : "accepted";
  await admin.from("proposals").update({ status: newStatus }).eq("id", proposal.id);

  // Notify owner
  try {
    const { data: business } = await admin
      .from("businesses")
      .select("name, email, phone, sms_number, logo_url, sms_notifications, whatsapp_notifications, email_notifications")
      .eq("id", proposal.business_id)
      .single();

    if (business) {
      const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com";
      const fmtAmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

      if (isCounter && insertedResponse?.review_token) {
        const reviewUrl = `${appBase}/proposal/review/${insertedResponse.review_token}`;
        const counterAmt = fmtAmt(Number(counterAmount));
        const origAmt = fmtAmt(Number(proposal.amount));

        const body = `
          <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${business.name}</strong> 👋</p>
          <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
            <strong>${proposal.client_name}</strong> sent a counter offer on <strong>${proposal.title}</strong>.
          </p>
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 18px;">
            <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:700;">Counter offer details</p>
            <p style="margin:0 0 4px;font-size:13px;color:#78350f;">💰 Their offer: <strong>${counterAmt}</strong> &nbsp;(your ask: ${origAmt})</p>
            <p style="margin:0 0 4px;font-size:13px;color:#78350f;">📅 Start: <strong>${startDate}${startMonthOnly ? " (month)" : ""}</strong></p>
            <p style="margin:0 0 4px;font-size:13px;color:#78350f;">💳 Payment: <strong>${selectedPaymentTerm ?? "—"}</strong></p>
            ${counterNote ? `<p style="margin:0;font-size:13px;color:#78350f;">📝 Note: "${counterNote}"</p>` : ""}
          </div>
          <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6;">
            Open the link below to <strong>approve</strong> or <strong>set your final price</strong> — no login needed.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
            <tr><td align="center">
              <a href="${reviewUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 44px;border-radius:10px;">
                Review Counter Offer &rarr;
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Only you received this link. Do not reply to this email.</p>
        `;

        const html = emailBase({ title: "Counter Offer Received", subtitle: proposal.title, businessName: business.name, logoUrl: business.logo_url ?? null, body });

        if (business.email_notifications !== false && business.email) {
          await sendEmail({
            to: business.email,
            subject: `💬 Counter offer from ${proposal.client_name} — ${proposal.title}`,
            html,
          });
        }

        // WhatsApp to owner
        if (business.whatsapp_notifications !== false && business.phone && insertedResponse?.review_token) {
          const fmtAmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
          const msg = buildProposalCounterMessage({
            reviewToken: insertedResponse.review_token,
            businessName: business.name,
            clientName: proposal.client_name,
            title: proposal.title,
            counterAmount: fmtAmt(Number(counterAmount)),
            originalAmount: fmtAmt(Number(proposal.amount)),
          });
          await sendWhatsAppTemplate({ toPhone: business.phone, ...msg }).catch(() => {});
        }

        // SMS to owner
        if (business.sms_notifications && (business.sms_number || business.phone) && insertedResponse?.review_token) {
          const reviewUrl = `${appBase}/proposal/review/${insertedResponse.review_token}`;
          const msg = smsProposalCounter({
            ownerName: business.name,
            clientName: proposal.client_name,
            title: proposal.title,
            counterAmount: fmtAmt(Number(counterAmount)),
            url: reviewUrl,
          });
          await sendSMS({ to: business.sms_number || business.phone, message: msg }).catch(() => {});
        }
      } else {
        // Straight accept — notify owner
        const ownerBody = `
          <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${business.name}</strong> 👋</p>
          <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
            <strong>${proposal.client_name}</strong> accepted your proposal <strong>${proposal.title}</strong>.
          </p>
          <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#166534;">💰 Amount: <strong>${fmtAmt(Number(proposal.amount))}</strong></p>
            <p style="margin:0 0 4px;font-size:13px;color:#166534;">📅 Start: <strong>${startDate}${startMonthOnly ? " (month)" : ""}</strong></p>
            <p style="margin:0;font-size:13px;color:#166534;">💳 Payment: <strong>${selectedPaymentTerm ?? "—"}</strong></p>
          </div>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Do not reply to this email.</p>
        `;
        const ownerHtml = emailBase({ title: "Proposal Accepted!", subtitle: proposal.title, businessName: business.name, logoUrl: business.logo_url ?? null, body: ownerBody });
        if (business.email_notifications !== false && business.email) {
          await sendEmail({ to: business.email, subject: `✅ ${proposal.client_name} accepted — ${proposal.title}`, html: ownerHtml });
        }

        // Confirm back to client
        if (proposal.client_email) {
          const clientBody = `
            <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${proposal.client_name}</strong> 👋</p>
            <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
              ✅ <strong>${business.name}</strong> has received your acceptance of <strong>${proposal.title}</strong>.
            </p>
            <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
              <p style="margin:0 0 4px;font-size:13px;color:#166534;">💰 Amount: <strong>${fmtAmt(Number(proposal.amount))}</strong></p>
              <p style="margin:0 0 4px;font-size:13px;color:#166534;">📅 Start: <strong>${startDate}${startMonthOnly ? " (month)" : ""}</strong></p>
              ${selectedPaymentTerm ? `<p style="margin:0;font-size:13px;color:#166534;">💳 Payment: <strong>${selectedPaymentTerm}</strong></p>` : ""}
            </div>
            <p style="font-size:13px;color:#374151;margin:0 0 20px;line-height:1.6;">
              ${business.name} will be in touch to confirm next steps. Keep this email as your record of acceptance.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Do not reply to this email.</p>
          `;
          const clientHtml = emailBase({ title: "Proposal Accepted ✅", subtitle: proposal.title, businessName: business.name, logoUrl: business.logo_url ?? null, body: clientBody });
          await sendEmail({
            to: proposal.client_email,
            subject: `Your acceptance is confirmed — ${proposal.title} · ${business.name}`,
            html: clientHtml,
          }).catch(() => {});
        }

        if (proposal.client_phone) {
          const msg = buildProposalApprovedMessage({
            clientName:   proposal.client_name,
            businessName: business.name,
            title:        proposal.title,
          });
          await sendWhatsAppTemplate({ toPhone: proposal.client_phone, ...msg }).catch(() => {});
        }
      }
    }
  } catch {
    // Notification failure must not block the client response
  }

  return NextResponse.json({ success: true, status: newStatus });
}
