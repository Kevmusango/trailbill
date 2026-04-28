import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase } from "@/lib/email-template";
import { sendSMS, smsProposalDeclined } from "@/lib/sms";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fmtAmt(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: proposal } = await admin
    .from("proposals")
    .select("id, title, client_name, status, business_id, amount, businesses:business_id(name, logo_url, email, phone, sms_number, sms_notifications, email_notifications)")
    .eq("public_token", token)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status !== "owner_revised") {
    return NextResponse.json({ error: "Nothing to decline" }, { status: 400 });
  }

  await admin.from("proposals").update({ status: "declined" }).eq("id", proposal.id);

  // Notify owner
  try {
    const business = proposal.businesses as any;
    if (business?.email) {
      const body = `
        <p style="font-size:15px;margin:0 0 14px;">Hi <strong>${business.name}</strong>,</p>
        <p style="font-size:15px;margin:0 0 18px;line-height:1.6;">
          <strong>${proposal.client_name}</strong> has <strong>declined your final offer</strong> of ${fmtAmt(Number(proposal.amount))} on <strong>${proposal.title}</strong>.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0;font-size:13px;color:#991b1b;">The proposal has been closed. You may reach out to ${proposal.client_name} directly to renegotiate.</p>
        </div>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Do not reply to this email.</p>
      `;
      const html = emailBase({
        title: "Final Offer Declined",
        subtitle: proposal.title,
        businessName: business.name,
        logoUrl: business.logo_url ?? null,
        body,
      });
      if (business.email_notifications !== false) {
        await sendEmail({
          to: business.email,
          subject: `${proposal.client_name} declined your final offer — ${proposal.title}`,
          html,
        });
      }
    }
    // SMS to owner
    if (business?.sms_notifications && (business.sms_number || business.phone)) {
      const msg = smsProposalDeclined({
        ownerName: business.name,
        clientName: proposal.client_name,
        title: proposal.title,
      });
      await sendSMS({ to: business.sms_number || business.phone, message: msg }).catch(() => {});
    }
  } catch {
    // Notification failure must not block
  }

  return NextResponse.json({ success: true });
}
