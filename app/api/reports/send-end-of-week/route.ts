import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import {
  emailBase, statsBox, sectionHeader, clientRow,
  progressBar, emptyState, fmtMoney,
} from "@/lib/email-template";
import { getSastTimeWindow, getSastDayName } from "@/lib/cron-utils";

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const label = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  return { start: fmt(mon), end: fmt(sun), label: `${label(mon)} – ${label(sun)}` };
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { start, end, label: weekLabel } = getWeekBounds();

  const { slotStart, slotEnd } = getSastTimeWindow();
  const todayDay = getSastDayName();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, email, logo_url")
    .eq("end_of_week_report_enabled", true)
    .eq("end_of_week_report_day", todayDay)
    .not("email", "is", null)
    .gte("end_of_week_report_time", slotStart)
    .lt("end_of_week_report_time", slotEnd);

  let sent = 0;
  for (const biz of (businesses ?? [])) {
    try {
      const [{ data: requests }, { data: payments }, { data: flags }] = await Promise.all([
        supabase.from("payment_requests")
          .select("total_due, outstanding, status, due_date, clients(name)")
          .eq("business_id", biz.id).gte("due_date", start).lte("due_date", end),
        supabase.from("payments")
          .select("amount, clients(name)")
          .eq("business_id", biz.id).gte("payment_date", start).lte("payment_date", end),
        supabase.from("behavior_flags")
          .select("flag_type, clients(name)").eq("business_id", biz.id)
          .gte("created_at", start).lte("created_at", end + "T23:59:59").limit(5),
      ]);

      const reqs  = requests ?? [];
      const pays  = payments ?? [];
      const totalExpected = reqs.reduce((s, r) => s + Number(r.total_due), 0);
      const totalReceived = pays.reduce((s, p) => s + Number(p.amount), 0);
      const stillOwed = reqs.filter(r => r.status !== "paid").reduce((s, r) => s + Number(r.outstanding), 0);
      const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
      const paid    = reqs.filter(r => r.status === "paid");
      const waiting = reqs.filter(r => r.status !== "paid");

      const FLAG_FRIENDLY: Record<string, string> = {
        first_miss: "First payment issue", needs_attention: "Needs attention",
        watch: "Worth watching", reliable: "Paying on time", improving: "Improving",
      };

      const body = `
        ${statsBox([
          { label: "Collected", value: fmtMoney(totalReceived) },
          { label: "Outstanding", value: fmtMoney(stillOwed) },
          { label: "Rate", value: `${pct}%` },
        ])}
        ${progressBar(pct)}

        ${paid.length > 0 ? `
          ${sectionHeader(`Paid this week (${paid.length})`)}
          <table width="100%" cellpadding="0" cellspacing="0">
            ${(paid as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", "Paid", fmtMoney(Number(r.total_due)))).join("")}
          </table>` : ""}

        ${waiting.length > 0 ? `
          ${sectionHeader(`Still outstanding (${waiting.length})`)}
          <table width="100%" cellpadding="0" cellspacing="0">
            ${(waiting as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", "Not yet paid", fmtMoney(Number(r.outstanding)), true)).join("")}
          </table>` : ""}

        ${(flags ?? []).length > 0 ? `
          ${sectionHeader("New alerts this week")}
          <table width="100%" cellpadding="0" cellspacing="0">
            ${(flags as any[]).map(f => clientRow((f.clients as any)?.name ?? "Unknown", FLAG_FRIENDLY[f.flag_type] ?? f.flag_type, "")).join("")}
          </table>` : ""}

        ${reqs.length === 0 ? emptyState("No activity due this week.") : ""}
      `;

      const html = emailBase({ title: "End of Week Summary", subtitle: weekLabel, businessName: biz.name, body, logoUrl: (biz as any).logo_url });
      await sendEmail({ to: biz.email!, subject: `End of Week Summary — ${weekLabel}`, html });

      await supabase.from("report_log").insert({
        business_id: biz.id, report_type: "end_of_week", period_label: weekLabel,
        period_start: start, period_end: end,
        email_sent_to: biz.email, sent_at: new Date().toISOString(),
      });

      sent++;
    } catch (err) {
      console.error(`End of week report failed for ${biz.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
