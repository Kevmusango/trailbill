import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { getSastTimeWindow } from "@/lib/cron-utils";
import { buildDailyReport } from "@/lib/report-builders";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");

  const { slotStart, slotEnd } = getSastTimeWindow();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, email, logo_url")
    .eq("daily_digest_enabled", true)
    .not("email", "is", null)
    .gte("daily_digest_time", slotStart)
    .lt("daily_digest_time", slotEnd);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  let sent = 0;

  for (const biz of (businesses ?? [])) {
    try {
      const { html, subject, periodLabel, skip } = await buildDailyReport(
        supabase, biz.id, biz.name, appUrl, (biz as any).logo_url
      );
      if (skip) continue;
      await sendEmail({ to: biz.email!, subject, html });
      await supabase.from("report_log").insert({
        business_id: biz.id, report_type: "daily_digest", period_label: periodLabel,
        period_start: today, period_end: today,
        email_sent_to: biz.email, sent_at: new Date().toISOString(),
      });
      sent++;
    } catch (err) {
      console.error(`Daily digest failed for ${biz.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
