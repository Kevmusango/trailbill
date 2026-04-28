import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";
import {
  emailBase, statsBox, sectionHeader, clientRow,
  progressBar, emptyState, fmtMoney,
} from "@/lib/email-template";
import { buildDailyReport, buildWeeklyReport, buildMonthlyReport } from "@/lib/report-builders";

const MONTH_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await request.json();
  const validTypes = ["daily", "weekly", "end_of_week", "month_start", "monthly"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, email, logo_url")
    .eq("owner_id", user.id)
    .single();

  if (!business?.email) {
    return NextResponse.json({ error: "No email address set on your business. Add one in Settings first." }, { status: 400 });
  }

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.trailbill.com").replace(/\/$/, "");
  const now = new Date();

  // ── Daily ──────────────────────────────────────────────────────────────────
  if (type === "daily") {
    const { html, subject } = await buildDailyReport(svc, business.id, business.name, appUrl, (business as any).logo_url);
    const { error } = await sendEmail({ to: business.email, subject, html });
    if (error) return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: business.email });
  }

  // ── Weekly ─────────────────────────────────────────────────────────────────
  if (type === "weekly") {
    const { html, subject } = await buildWeeklyReport(svc, business.id, business.name, appUrl, (business as any).logo_url);
    const { error } = await sendEmail({ to: business.email, subject, html });
    if (error) return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: business.email });
  }

  // ── End of week ────────────────────────────────────────────────────────────
  if (type === "end_of_week") {
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const weekStart = mon.toISOString().split("T")[0];
    const weekEnd   = sun.toISOString().split("T")[0];
    const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

    const [{ data: requests }, { data: payments }, { data: flags }] = await Promise.all([
      svc.from("payment_requests").select("total_due, outstanding, status, due_date, clients(name)")
        .eq("business_id", business.id).gte("due_date", weekStart).lte("due_date", weekEnd),
      svc.from("payments").select("amount, clients(name)")
        .eq("business_id", business.id).gte("payment_date", weekStart).lte("payment_date", weekEnd),
      svc.from("behavior_flags").select("flag_type, clients(name)").eq("business_id", business.id)
        .gte("created_at", weekStart).lte("created_at", weekEnd + "T23:59:59").limit(5),
    ]);
    const reqs = requests ?? [];
    const pays = payments ?? [];
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
      ${statsBox([{ label: "Collected", value: fmtMoney(totalReceived) }, { label: "Outstanding", value: fmtMoney(stillOwed) }, { label: "Rate", value: `${pct}%` }])}
      ${progressBar(pct)}
      ${paid.length > 0 ? `${sectionHeader(`Paid this week (${paid.length})`)}<table width="100%" cellpadding="0" cellspacing="0">${(paid as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", "Paid", fmtMoney(Number(r.total_due)))).join("")}</table>` : ""}
      ${waiting.length > 0 ? `${sectionHeader(`Still outstanding (${waiting.length})`)}<table width="100%" cellpadding="0" cellspacing="0">${(waiting as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", "Not yet paid", fmtMoney(Number(r.outstanding)), true)).join("")}</table>` : ""}
      ${(flags ?? []).length > 0 ? `${sectionHeader("New alerts this week")}<table width="100%" cellpadding="0" cellspacing="0">${(flags as any[]).map(f => clientRow((f.clients as any)?.name ?? "Unknown", FLAG_FRIENDLY[f.flag_type] ?? f.flag_type, "")).join("")}</table>` : ""}
      ${reqs.length === 0 ? emptyState("No activity due this week.") : ""}
    `;
    const html = emailBase({ title: "End of Week Summary", subtitle: weekLabel, businessName: business.name, body, logoUrl: (business as any).logo_url });
    const { error } = await sendEmail({ to: business.email, subject: `End of Week Summary — ${weekLabel}`, html });
    if (error) return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: business.email });
  }

  // ── Month Start ────────────────────────────────────────────────────────────
  if (type === "month_start") {
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart  = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay     = new Date(year, month, 0).getDate();
    const monthEnd    = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const periodLabel = `${MONTH_LONG[month - 1]} ${year}`;

    const { data: requests } = await svc.from("payment_requests")
      .select("total_due, status, due_date, clients(name)")
      .eq("business_id", business.id).gte("due_date", monthStart).lte("due_date", monthEnd).order("due_date");
    const reqs = requests ?? [];
    const totalExpected = reqs.reduce((s, r) => s + Number(r.total_due), 0);
    const upcoming = reqs.filter(r => r.status !== "paid");

    const body = `
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Here's your forecast for <strong>${periodLabel}</strong>.</p>
      ${statsBox([{ label: "Expected this month", value: fmtMoney(totalExpected) }, { label: "Clients with dues", value: String(reqs.length) }, { label: "Already paid", value: String(reqs.length - upcoming.length) }])}
      ${upcoming.length > 0 ? `${sectionHeader(`Upcoming payments (${upcoming.length})`)}<table width="100%" cellpadding="0" cellspacing="0">${(upcoming as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", `Due ${fmtDate(r.due_date)}`, fmtMoney(Number(r.total_due)))).join("")}</table>` : emptyState("No upcoming payments found for this month.")}
    `;
    const html = emailBase({ title: "Month Start Forecast", subtitle: periodLabel, businessName: business.name, body, logoUrl: (business as any).logo_url });
    const { error } = await sendEmail({ to: business.email, subject: `Month Start Forecast — ${periodLabel}`, html });
    if (error) return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: business.email });
  }

  // ── Monthly (end of month) ─────────────────────────────────────────────────
  if (type === "monthly") {
    const { html, subject } = await buildMonthlyReport(svc, business.id, business.name, appUrl, (business as any).logo_url);
    const { error } = await sendEmail({ to: business.email, subject, html });
    if (error) return NextResponse.json({ error: "Email failed to send" }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: business.email });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
