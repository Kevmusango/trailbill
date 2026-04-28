import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase, fmtMoney } from "@/lib/email-template";
import { getSastTimeWindow } from "@/lib/cron-utils";
import { buildReminderWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

const PRIMARY = "#0DA2E7";

const SUBJECTS: Record<string, string> = {
  "1_day_before":    "Reminder: your payment is due tomorrow",
  "due_date":        "Your payment is due today",
  "1_day_after":     "Following up on your payment",
  "3_days_after":    "Friendly follow-up — payment outstanding",
  "7_days_after":    "Payment follow-up — please respond",
};

const INTROS: Record<string, string> = {
  "1_day_before":    "Just a gentle reminder that your payment is due <strong>tomorrow</strong>. If you’ve already arranged it, please disregard this message.",
  "due_date":        "This is a kind reminder that your payment is <strong>due today</strong>. Please make payment at your convenience.",
  "1_day_after":     "We noticed your payment hasn’t come through yet — no worries. Please arrange it at your earliest convenience.",
  "3_days_after":    "We’re following up on your payment, which is now <strong>3 days overdue</strong>. If you’re experiencing any difficulties, please reach out — we’re happy to assist.",
  "7_days_after":    "We’re still following up on your outstanding payment, now <strong>7 days overdue</strong>. Please arrange payment or contact us if you need any assistance.",
};

function buildReminderEmail({
  clientName, businessName, bizPhone, bizEmail, amount, dueDate, payUrl, reminderType, description,
}: {
  clientName: string; businessName: string; bizPhone?: string | null; bizEmail?: string | null;
  amount: number; dueDate: string; payUrl: string; reminderType: string; description?: string | null;
}) {
  const dueFmt = new Date(dueDate + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
  const isOverdue = ["1_day_after", "3_days_after", "7_days_after"].includes(reminderType);
  const amountColor = isOverdue ? "#b45309" : PRIMARY;
  const btnColor    = isOverdue ? "#ef4444" : PRIMARY;

  const contactLine = (bizPhone || bizEmail)
    ? `<div style="margin:20px 0 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">For more information, contact <strong>${businessName}</strong>:</p>
        ${bizPhone ? `<p style="margin:0 ${bizEmail ? "0 2px" : ""};font-size:13px;font-weight:600;color:#111827;">&#128222; ${bizPhone}</p>` : ""}
        ${bizEmail ? `<p style="margin:0;font-size:13px;color:${PRIMARY};">${bizEmail}</p>` : ""}
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${clientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
      ${INTROS[reminderType] ?? "You have a pending payment."} This is from <strong>${businessName}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
      ${description ? `<tr>
        <td style="font-size:13px;color:#6b7280;padding:12px 16px 4px;">Payment for</td>
        <td style="font-size:13px;font-weight:700;text-align:right;padding:12px 16px 4px;color:#111827;">${description}</td>
      </tr>` : ""}
      <tr>
        <td style="font-size:13px;color:#6b7280;padding:${description ? "4px" : "12px"} 16px 4px;">Amount ${isOverdue ? "Outstanding" : "Due"}</td>
        <td style="font-size:22px;font-weight:800;color:${amountColor};text-align:right;padding:${description ? "4px" : "12px"} 16px 4px;">${fmtMoney(amount)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6b7280;padding:4px 16px 12px;">Due Date</td>
        <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 16px 12px;">${dueFmt}</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr><td align="center">
        <a href="${payUrl}"
          style="display:inline-block;background:${btnColor};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
          &#128197; ${isOverdue ? "View &amp; Settle Now" : "View &amp; Pay"}
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-align:center;">
      Includes your banking details &amp; payment reference
    </p>
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
      Or open: <a href="${payUrl}" style="color:${PRIMARY};">${payUrl}</a>
    </p>
    ${contactLine}
  `;
  return emailBase({ title: SUBJECTS[reminderType] ?? "Payment Reminder", subtitle: dueFmt, businessName, body });
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");

  const { slotStart, slotEnd } = getSastTimeWindow();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, email, phone")
    .eq("status", "active")
    .gte("reminder_send_time", slotStart)
    .lt("reminder_send_time", slotEnd);

  let totalSent = 0;
  let totalSkipped = 0;

  for (const biz of businesses ?? []) {
    const { data: reminders } = await supabase
      .rpc("get_todays_reminders", { business_uuid: biz.id });

    for (const reminder of reminders ?? []) {
      if (reminder.already_sent) {
        totalSkipped++;
        continue;
      }
      if (!reminder.reminder_type) continue;

      const { data: reqRow } = await supabase
        .from("payment_requests")
        .select("public_token, request_number, client_id, description, notification_channels, grace_end_date, late_fee_pct, base_amount, amount_paid, total_due, clients(name, email, phone)")
        .eq("id", reminder.request_id)
        .single();

      if (!reqRow) continue;
      const client = reqRow.clients as unknown as { name: string; email: string | null; phone: string | null } | null;
      const channel = reqRow.notification_channels ?? "";
      const shouldSendEmail = reminder.should_send_email ?? ["email", "both"].includes(channel);
      const shouldSendWhatsApp = reminder.should_send_whatsapp ?? ["whatsapp", "both"].includes(channel);

      if (!shouldSendEmail && !shouldSendWhatsApp) {
        totalSkipped++;
        continue;
      }

      // Auto-apply late fee on overdue follow-ups after grace period expires
      const isOverdueReminder = ["1_day_after", "3_days_after", "7_days_after"].includes(reminder.reminder_type);
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
      const graceExpired = reqRow.grace_end_date ? reqRow.grace_end_date < todayStr : true;
      const lateFeeNotYetApplied = Number(reqRow.total_due) === Number(reqRow.base_amount);
      let sendAmount = Number(reminder.amount);

      if (isOverdueReminder && graceExpired && Number(reqRow.late_fee_pct) > 0 && lateFeeNotYetApplied) {
        const lateFee = Number(reqRow.base_amount) * (Number(reqRow.late_fee_pct) / 100);
        const newTotalDue = Number(reqRow.base_amount) + lateFee;
        const newOutstanding = Math.max(newTotalDue - Number(reqRow.amount_paid), 0);
        await supabase
          .from("payment_requests")
          .update({ total_due: newTotalDue, outstanding: newOutstanding })
          .eq("id", reminder.request_id);
        sendAmount = newTotalDue;
      }

      const payUrl = `${appUrl}/pay/${reqRow.public_token}`;
      let sentThisReminder = false;

      if (shouldSendEmail && client?.email) {
        const html = buildReminderEmail({
          clientName: client.name,
          businessName: biz.name,
          bizPhone: biz.phone ?? null,
          bizEmail: biz.email ?? null,
          amount: sendAmount,
          dueDate: reminder.due_date,
          payUrl,
          reminderType: reminder.reminder_type,
          description: reqRow.description ?? null,
        });

        const result = await sendEmail({
          to: client.email,
          subject: `${SUBJECTS[reminder.reminder_type] ?? "Payment Reminder"} — ${biz.name}`,
          html,
        });

        if (!result.error) {
          await supabase.from("reminder_log").insert({
            request_id:    reminder.request_id,
            client_id:     reqRow.client_id,
            business_id:   biz.id,
            channel:       "email",
            reminder_type: reminder.reminder_type,
            status:        "sent",
            sent_at:       new Date().toISOString(),
          });
          totalSent++;
          sentThisReminder = true;
        }
      }

      if (shouldSendWhatsApp && client?.phone) {
        const msg = buildReminderWhatsAppMessage({
          token: reqRow.public_token,
          reminderType: reminder.reminder_type,
          clientName: client.name,
          businessName: biz.name,
          amount: sendAmount,
          requestNumber: reqRow.request_number,
          dueDate: reminder.due_date,
          description: reqRow.description ?? null,
          bizPhone: biz.phone ?? null,
        });

        const waResult = await sendWhatsAppTemplate({
          toPhone: client.phone,
          template: msg.template,
          bodyValues: msg.bodyValues,
          buttonUrlToken: msg.buttonUrlToken,
        });

        if (waResult.sent) {
          await supabase.from("reminder_log").insert({
            request_id:    reminder.request_id,
            client_id:     reqRow.client_id,
            business_id:   biz.id,
            channel:       "whatsapp",
            reminder_type: reminder.reminder_type,
            status:        "sent",
            provider_message_id: waResult.providerMessageId ?? null,
            provider_status: "sent",
            provider_payload: waResult.providerMessageId ? { message_id: waResult.providerMessageId } : {},
            sent_at:       new Date().toISOString(),
          });
          totalSent++;
          sentThisReminder = true;
        }
      }

      if (!sentThisReminder) {
        totalSkipped++;
      }
    }
  }

  return NextResponse.json({ sent: totalSent, skipped: totalSkipped });
}
