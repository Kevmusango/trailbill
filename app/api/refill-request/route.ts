import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pack, credits, price, contactPhone, message } = await request.json();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, email, credits_remaining, credits_monthly")
    .eq("owner_id", user.id)
    .single();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;color:#1a1a1a;background:#f9fafb;padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <div style="background:#0DA2E7;padding:24px 28px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">💳 Credit Refill Request</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">A business is requesting a credit top-up</p>
        </div>
        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Business</td><td style="padding:8px 0;font-weight:600;">${business.name}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${business.email}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;font-weight:600;">${contactPhone || "Not provided"}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Current Credits</td><td style="padding:8px 0;">${business.credits_remaining} / ${business.credits_monthly}</td></tr>
            <tr style="background:#f0f9ff;"><td style="padding:10px 8px;color:#6b7280;border-radius:6px 0 0 6px;">Requested Pack</td><td style="padding:10px 8px;font-weight:700;color:#0DA2E7;border-radius:0 6px 6px 0;">${pack} — ${credits} credits @ ${price}</td></tr>
          </table>
          ${message ? `<div style="margin-top:16px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;font-size:14px;"><strong>Message:</strong><br/>${message}</div>` : ""}
          <p style="margin-top:24px;font-size:13px;color:#6b7280;">Log into the admin panel and use the <strong>Credits</strong> button to process this request.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Save to DB for admin dashboard
  await supabase.from("refill_requests").insert({
    business_id:    business.id,
    business_name:  business.name,
    business_email: business.email,
    pack_label:     pack,
    pack_credits:   credits,
    pack_price:     price,
    contact_phone:  contactPhone || null,
    message:        message || null,
  });

  // Send email notification
  const { error } = await sendEmail({
    to: "sales@trailbill.com",
    subject: `Credit Refill Request — ${business.name} (${pack})`,
    html,
  });

  if (error) return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });

  return NextResponse.json({ success: true });
}
