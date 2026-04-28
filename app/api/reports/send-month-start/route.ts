import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import { emailBase, statsBox, sectionHeader, clientRow, emptyState, fmtMoney } from "@/lib/email-template";
import { getSastTimeWindow } from "@/lib/cron-utils";

const MONTH_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const periodLabel = `${MONTH_LONG[month - 1]} ${year}`;

  const { slotStart, slotEnd } = getSastTimeWindow();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, email, logo_url")
    .eq("month_start_report_enabled", true)
    .not("email", "is", null)
    .gte("month_start_report_time", slotStart)
    .lt("month_start_report_time", slotEnd);

  let sent = 0;
  for (const biz of (businesses ?? [])) {
    try {
      const { data: requests } = await supabase
        .from("payment_requests")
        .select("total_due, status, due_date, clients(name)")
        .eq("business_id", biz.id).gte("due_date", monthStart).lte("due_date", monthEnd)
        .order("due_date");

      const reqs = requests ?? [];
      const totalExpected = reqs.reduce((s, r) => s + Number(r.total_due), 0);
      const upcoming = reqs.filter(r => r.status !== "paid");

      const body = `
        <p style="font-size:14px;color:#374151;margin:0 0 16px;">
          Here's your forecast for <strong>${periodLabel}</strong>.
        </p>
        ${statsBox([
          { label: "Expected this month", value: fmtMoney(totalExpected) },
          { label: "Clients with dues", value: String(reqs.length) },
          { label: "Already paid", value: String(reqs.length - upcoming.length) },
        ])}

        ${upcoming.length > 0 ? `
          ${sectionHeader(`Upcoming payments (${upcoming.length})`)}
          <table width="100%" cellpadding="0" cellspacing="0">
            ${(upcoming as any[]).map(r => clientRow(
              (r.clients as any)?.name ?? "Unknown",
              `Due ${new Date(r.due_date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}`,
              fmtMoney(Number(r.total_due))
            )).join("")}
          </table>` : emptyState("No upcoming payments found for this month.")}
      `;

      const html = emailBase({ title: "Month Start Forecast", subtitle: periodLabel, businessName: biz.name, body, logoUrl: (biz as any).logo_url });
      await sendEmail({ to: biz.email!, subject: `Month Start Forecast — ${periodLabel}`, html });

      await supabase.from("report_log").insert({
        business_id: biz.id, report_type: "month_start", period_label: periodLabel,
        period_start: monthStart, period_end: monthEnd,
        email_sent_to: biz.email, sent_at: new Date().toISOString(),
        content_json: { expected: totalExpected, count: reqs.length },
      });

      sent++;
    } catch (err) {
      console.error(`Month start forecast failed for ${biz.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
