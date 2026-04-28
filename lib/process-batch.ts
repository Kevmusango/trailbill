import { sendEmail } from "@/lib/resend";
import { emailBase, fmtMoney } from "@/lib/email-template";
import { buildInitialWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { sendSMS } from "@/lib/sms";

const PRIMARY = "#0DA2E7";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function daysBetweenDates(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

function buildPaymentEmail({
  clientName, businessName, amount, dueDate, payUrl, logoUrl, description,
  graceEndDate, lateFeePercent, finalDueDate,
}: {
  clientName: string; businessName: string; amount: number; dueDate: string;
  payUrl: string; logoUrl?: string | null; description?: string | null;
  graceEndDate?: string | null; lateFeePercent?: number | null; finalDueDate?: string | null;
}) {
  const dueFmt = fmtDate(dueDate);

  const graceDays = graceEndDate ? daysBetweenDates(dueDate, graceEndDate) : 0;
  const graceEndFmt = graceEndDate ? fmtDate(graceEndDate) : null;


  const graceHtml = graceDays > 0 && graceEndFmt
    ? `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin:0 0 20px;">
        <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
          &#127873; You have <strong>${graceDays} free grace days</strong> &mdash; claim them now and pay <strong>${fmtMoney(amount)}</strong>, nothing added.
        </p>
      </div>`
    : "";

  const btnColor = graceDays > 0 ? "#16a34a" : PRIMARY;
  const btnText  = graceDays > 0 ? "&#128197; Claim your free days &rarr;" : "&#128197; Pick your payment date &rarr;";

  const descPart = description ? ` for <em>${description}</em>` : "";
  const urgencyInline = lateFeePercent && lateFeePercent > 0
    ? ` Miss it &rarr; a <strong style="color:#b45309;">flat ${lateFeePercent}% late fee</strong> will be added.`
    : "";

  const openingLine = graceDays > 0
    ? `<strong>${businessName}</strong> sent you a payment request${descPart} of
      <strong style="color:${PRIMARY};">${fmtMoney(amount)}</strong>
      and is due <strong>${dueFmt}</strong>.${urgencyInline}`
    : `<strong>${businessName}</strong> sent you a payment request${descPart} of
      <strong style="color:${PRIMARY};">${fmtMoney(amount)}</strong>.
      Open the link below to pick your payment date${dueFmt ? ` — target date is <strong>${dueFmt}</strong>` : ""}.`;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;">Hi <strong>${clientName}</strong> &#128075;</p>

    <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.7;">
      ${openingLine}
    </p>

    ${graceHtml}

    <!-- Single CTA -->
    <a href="${payUrl}"
      style="display:block;background:${btnColor};color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 20px;border-radius:10px;text-align:center;margin:0 0 20px;">
      ${btnText}
    </a>

    <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;text-align:center;">
      Or open in browser: <a href="${payUrl}" style="color:${PRIMARY};">${payUrl}</a>
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
      Thank you for being a valued client &#128153;<br/>
      <strong style="color:#111827;">${businessName}</strong> via TrailBill
    </p>
  `;
  return emailBase({ title: "Payment Request", subtitle: dueFmt, businessName, body, logoUrl });
}

/**
 * Sends payment request emails for all requests in the given batch IDs.
 * Updates payment_requests.status to "sent" per request after successful send.
 * Also logs to reminder_log if the due date is today or tomorrow (prevents duplicate reminders).
 * Safe to call from both the cron and the send routes.
 */
export async function processBatchEmails(
  batchIds: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  appUrl: string,
): Promise<{ emailed: number; whatsapped: number; smsSent: number; failed: number; skipped: number; skipReasons: string[]; failReasons: string[]; creditsCharged: number }> {
  const { data: requests } = await supabase
    .from("payment_requests")
    .select("id, public_token, request_number, total_due, due_date, grace_end_date, final_due_date, late_fee_pct, description, notification_channels, client_id, business_id, clients(name, email, phone, sms_number), businesses(name, logo_url, phone)")
    .in("batch_id", batchIds);

  const todaySast = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  let emailed = 0;
  let whatsapped = 0;
  let smsSentTotal = 0;
  let failed = 0;
  let skipped = 0;
  let creditsCharged = 0;
  const skipReasons: string[] = [];
  const failReasons: string[] = [];

  for (const req of requests ?? []) {
    let client: { name: string; email: string | null; phone: string | null; sms_number: string | null } | null = null;
    let biz: { name: string; logo_url?: string | null; phone?: string | null } | null = null;
    try {
    client = req.clients as { name: string; email: string | null; phone: string | null; sms_number: string | null } | null;
    biz    = req.businesses as { name: string; logo_url?: string | null; phone?: string | null } | null;
    const channel = req.notification_channels ?? "email";
    const shouldSendEmail    = ["email", "both", "email+sms", "all"].includes(channel);
    const shouldSendWhatsApp = ["whatsapp", "both", "whatsapp+sms", "all"].includes(channel);
    const shouldSendSMS      = ["sms", "email+sms", "whatsapp+sms", "all"].includes(channel);

    const tomorrow = new Date(todaySast + "T00:00:00");
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const initialReminderType =
      req.due_date === todaySast    ? "due_date"
      : req.due_date === tomorrowStr ? "1_day_before"
      : null;

    if (!biz?.name) {
      skipped++;
      skipReasons.push(`${client?.name ?? "Unknown client"}: business details missing`);
      await supabase.from("payment_requests").update({ status: "sent" }).eq("id", req.id);
      continue;
    }

    if (!shouldSendEmail && !shouldSendWhatsApp && !shouldSendSMS) {
      console.warn(`[process-batch] skipping req ${req.id}: unsupported channel ${req.notification_channels}`);
      skipReasons.push(`${client?.name ?? "Unknown client"}: channel is ${req.notification_channels} (unsupported)`);
      skipped++;
      await supabase.from("payment_requests").update({ status: "sent" }).eq("id", req.id);
      continue;
    }

    let emailSent = false;
    let waSent = false;
    let smsSent = false;

    const payUrl = `${appUrl}/pay/${req.public_token}`;

    if (shouldSendEmail) {
      if (!client?.email) {
        skipped++;
        skipReasons.push(`${client?.name ?? "Unknown client"}: no email address`);
      } else {
        const result = await sendEmail({
          to: client.email,
          subject: `Your payment with ${biz.name} — ${fmtMoney(Number(req.total_due))}`,
          html: buildPaymentEmail({
            clientName:      client.name,
            businessName:    biz.name,
            amount:          Number(req.total_due),
            dueDate:         req.due_date,
            payUrl,
            logoUrl:         biz.logo_url,
            description:     req.description ?? null,
            graceEndDate:    req.grace_end_date ?? null,
            lateFeePercent:  req.late_fee_pct ? Number(req.late_fee_pct) : null,
            finalDueDate:    req.final_due_date ?? null,
          }),
        });

        if (!result.error) {
          emailSent = true;
          emailed++;
          if (initialReminderType) {
            await supabase.from("reminder_log").insert({
              request_id:    req.id,
              client_id:     req.client_id,
              business_id:   req.business_id,
              channel:       "email",
              reminder_type: initialReminderType,
              status:        "sent",
              sent_at:       new Date().toISOString(),
            });
          }
        } else {
          failed++;
          failReasons.push(`${client.name}: email not delivered`);
          console.error(`[process-batch] email failed for ${client.email}:`, JSON.stringify(result.error));
        }
      }
    }

    if (shouldSendWhatsApp) {
      if (!client?.phone) {
        skipped++;
        skipReasons.push(`${client?.name ?? "Unknown client"}: no WhatsApp phone number`);
      } else {
        const msg = buildInitialWhatsAppMessage({
          token: req.public_token,
          clientName: client.name,
          businessName: biz.name,
          amount: Number(req.total_due),
          requestNumber: req.request_number,
          dueDate: req.due_date,
          description: req.description ?? null,
          graceEndDate: req.grace_end_date ?? null,
          lateFeePct: req.late_fee_pct ? Number(req.late_fee_pct) : null,
          bizPhone: biz.phone ?? null,
        });

        const waResult = await sendWhatsAppTemplate({
          toPhone: client.phone,
          template: msg.template,
          bodyValues: msg.bodyValues,
          buttonUrlToken: msg.buttonUrlToken,
        });

        const WA_CONFIG_REASONS = ["whatsapp_disabled", "whatsapp_not_configured", "whatsapp_credentials_invalid"];
        if (waResult.sent) {
          waSent = true;
          whatsapped++;
          if (initialReminderType) {
            await supabase.from("reminder_log").insert({
              request_id:    req.id,
              client_id:     req.client_id,
              business_id:   req.business_id,
              channel:       "whatsapp",
              reminder_type: initialReminderType,
              status:        "sent",
              provider_message_id: waResult.providerMessageId ?? null,
              provider_status: "sent",
              provider_payload: waResult.providerMessageId ? { message_id: waResult.providerMessageId } : {},
              sent_at:       new Date().toISOString(),
            });
          }
        } else if (waResult.skipped) {
          if (!WA_CONFIG_REASONS.includes(waResult.reason ?? "")) {
            skipped++;
            skipReasons.push(`${client.name}: WhatsApp skipped (${waResult.reason ?? "unknown"})`);
          }
          // else: silently skip — WhatsApp simply isn't configured, not a client issue
        } else {
          failed++;
          failReasons.push(`${client.name}: WhatsApp not delivered`);
          console.error(`[process-batch] whatsapp failed for request ${req.id} to ${client.phone}:`, waResult.reason);
        }
      }
    }

    if (shouldSendSMS) {
      const smsTo = client?.sms_number || client?.phone;
      if (!smsTo) {
        skipped++;
        skipReasons.push(`${client?.name ?? "Unknown client"}: no phone number for SMS`);
      } else {
        const smsText = req.grace_end_date
          ? `Hi ${client!.name}, ${biz!.name} sent a payment request of ${fmtMoney(Number(req.total_due))}. 🎁 Free grace days available — pick your date: ${appUrl}/pay/${req.public_token}`
          : `Hi ${client!.name}, ${biz!.name} sent a payment request of ${fmtMoney(Number(req.total_due))}. Pick your payment date: ${appUrl}/pay/${req.public_token}`;
        const smsResult = await sendSMS({ to: smsTo, message: smsText });
        if (smsResult.sent) {
          smsSent = true;
          smsSentTotal++;
        } else if (!smsResult.skipped) {
          failed++;
          failReasons.push(`${client!.name}: SMS not delivered`);
        }
      }
    }

    // Only charge credits for what was actually delivered
    creditsCharged += (emailSent ? 1 : 0) + (waSent ? 2 : 0) + (smsSent ? 2 : 0);

    const deliveredParts = [emailSent && "email", waSent && "whatsapp", smsSent && "sms"].filter(Boolean);
    const channelsSent = deliveredParts.length > 0 ? deliveredParts.join("+") : null;

    if (deliveredParts.length > 0) {
      await supabase.from("payment_requests").update({ status: "sent", channels_sent: channelsSent }).eq("id", req.id);
    }
    } catch (err) {
      failed++;
      console.error(`[process-batch] unexpected error for request ${req.id}:`, err);
    }
  }

  return { emailed, whatsapped, smsSent: smsSentTotal, failed, skipped, skipReasons, failReasons, creditsCharged };
}
