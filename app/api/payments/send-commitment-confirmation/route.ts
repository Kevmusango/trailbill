import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase, fmtMoney } from "@/lib/email-template";
import { buildCommitmentConfirmationWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

const PRIMARY = "#0DA2E7";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: row } = await supabase
    .from("payment_requests")
    .select(`
      id, public_token, request_number, description, notification_channels,
      committed_date, committed_amount, total_due,
      clients ( name, email, phone ),
      businesses ( name, phone, logo_url )
    `)
    .eq("public_token", token)
    .single();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.committed_date) return NextResponse.json({ error: "Not yet committed" }, { status: 400 });

  const client   = row.clients   as unknown as { name: string; email: string | null; phone: string | null } | null;
  const business = row.businesses as unknown as { name: string; phone: string | null; logo_url: string | null } | null;
  if (!client || !business) return NextResponse.json({ error: "Missing client or business" }, { status: 400 });

  const channel          = (row.notification_channels as string) ?? "email";
  const shouldSendEmail  = ["email", "both", "email+sms", "all"].includes(channel);
  const shouldSendWA     = ["whatsapp", "both", "whatsapp+sms", "all"].includes(channel);

  const amount     = Number(row.committed_amount ?? row.total_due);
  const dateFmt    = new Date(row.committed_date + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
  const appUrl     = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");
  const payUrl     = `${appUrl}/pay/${token}`;

  // Email confirmation
  if (shouldSendEmail && client.email) {
    const descPart = row.description ? ` for <strong>${row.description}</strong>` : "";
    const body = `
      <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${client.name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
        ✅ Your payment date is confirmed. <strong>${business.name}</strong> has noted that you will pay
        <strong style="color:${PRIMARY};">${fmtMoney(amount)}</strong>${descPart} by <strong>${dateFmt}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="margin:0 0 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <tr>
          <td style="font-size:13px;color:#6b7280;padding:12px 16px 4px;">Amount</td>
          <td style="font-size:22px;font-weight:800;color:${PRIMARY};text-align:right;padding:12px 16px 4px;">${fmtMoney(amount)}</td>
        </tr>
        ${row.description ? `<tr>
          <td style="font-size:13px;color:#6b7280;padding:4px 16px 4px;">For</td>
          <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 16px 4px;color:#111827;">${row.description}</td>
        </tr>` : ""}
        <tr>
          <td style="font-size:13px;color:#6b7280;padding:4px 16px 12px;">Your payment date</td>
          <td style="font-size:13px;font-weight:700;color:#16a34a;text-align:right;padding:4px 16px 12px;">${dateFmt}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;padding:4px 16px 12px;">Reference</td>
          <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 16px 12px;">${row.request_number}</td>
        </tr>
      </table>
      <p style="margin:0 0 20px;font-size:13px;color:#374151;line-height:1.6;">
        We'll send you a reminder the day before. Your banking details are available on the payment page below.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr><td align="center">
          <a href="${payUrl}"
            style="display:inline-block;background:${PRIMARY};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
            View Banking Details
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
        Or open: <a href="${payUrl}" style="color:${PRIMARY};">${payUrl}</a>
      </p>
    `;

    const html = emailBase({
      title: "Payment Date Confirmed ✅",
      subtitle: dateFmt,
      businessName: business.name,
      logoUrl: business.logo_url ?? null,
      body,
    });

    await sendEmail({
      to: client.email,
      subject: `Payment confirmed — ${fmtMoney(amount)} by ${dateFmt} · ${business.name}`,
      html,
    }).catch(() => {});
  }

  // WhatsApp confirmation
  if (shouldSendWA && client.phone) {
    const msg = buildCommitmentConfirmationWhatsAppMessage({
      token,
      clientName:    client.name,
      businessName:  business.name,
      amount,
      committedDate: row.committed_date,
      description:   row.description ?? null,
      requestNumber: row.request_number,
    });

    await sendWhatsAppTemplate({
      toPhone:        client.phone,
      template:       msg.template,
      bodyValues:     msg.bodyValues,
      buttonUrlToken: msg.buttonUrlToken,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
