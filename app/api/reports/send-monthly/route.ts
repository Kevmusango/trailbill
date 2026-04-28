import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { getSastTimeWindow } from "@/lib/cron-utils";
import { buildMonthlyReport } from "@/lib/report-builders";

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
    .eq("month_end_report_enabled", true)
    .not("email", "is", null)
    .gte("month_end_report_time", slotStart)
    .lt("month_end_report_time", slotEnd);

  let sent = 0;
  for (const biz of (businesses ?? [])) {
    try {
      const { html, subject, periodLabel, periodStart, periodEnd, stats } = await buildMonthlyReport(
        supabase, biz.id, biz.name, appUrl, (biz as any).logo_url
      );
      await sendEmail({ to: biz.email!, subject, html });
      await supabase.from("report_log").insert({
        business_id: biz.id, report_type: "month_end", period_label: periodLabel,
        period_start: periodStart, period_end: periodEnd,
        email_sent_to: biz.email, sent_at: new Date().toISOString(),
        content_json: stats,
      });
      sent++;
    } catch (err) {
      console.error(`Monthly report failed for ${biz.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
