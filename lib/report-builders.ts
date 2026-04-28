import {
  emailBase, statsBox, sectionHeader, clientRow, progressBar,
  emptyState, impactBanner, fmtMoney, ctaButton, alertHeader, attentionBox,
} from "@/lib/email-template";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// ── Daily Action Report ────────────────────────────────────────────────────

export async function buildDailyReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bizId: string,
  bizName: string,
  appUrl: string,
  bizLogo?: string | null,
): Promise<{ html: string; subject: string; periodLabel: string; skip: boolean }> {
  const now       = new Date();
  const todaySast = now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const todayLabel = now.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Johannesburg",
  });
  const yd = new Date(now); yd.setDate(yd.getDate() - 1);
  const yesterday  = yd.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const ydStart    = `${yesterday}T00:00:00+02:00`;
  const ydEnd      = `${todaySast}T00:00:00+02:00`;

  const [
    { data: dueToday },
    { data: overdueAll },
    { data: paidToday },
    { data: sentLog },
    { data: viewedLog },
    { data: paidYesterday },
    { data: failedLog },
  ] = await Promise.all([
    supabase.from("payment_requests").select("id, outstanding, clients(name)")
      .eq("business_id", bizId).eq("due_date", todaySast).neq("status", "paid"),

    supabase.from("payment_requests").select("id, outstanding, due_date, clients(name)")
      .eq("business_id", bizId).lt("due_date", todaySast).neq("status", "paid").order("due_date"),

    supabase.from("payments").select("amount, clients(name)")
      .eq("business_id", bizId).eq("payment_date", todaySast),

    supabase.from("reminder_log").select("request_id")
      .eq("business_id", bizId).gte("sent_at", ydStart).lt("sent_at", ydEnd),

    supabase.from("payment_events").select("request_id")
      .eq("business_id", bizId)
      .in("event_type", ["link_visited", "pay_now_clicked", "whatsapp_read", "email_opened"])
      .gte("created_at", ydStart).lt("created_at", ydEnd),

    supabase.from("payments").select("amount")
      .eq("business_id", bizId).eq("payment_date", yesterday),

    supabase.from("reminder_log").select("request_id")
      .eq("business_id", bizId).eq("provider_status", "failed").gte("sent_at", ydStart),
  ]);

  const sentIds    = [...new Set((sentLog    ?? []).map((s: any) => s.request_id as string))];
  const viewedIds  = new Set((viewedLog  ?? []).map((e: any) => e.request_id as string));
  const notViewIds = sentIds.filter(id => !viewedIds.has(id));
  const failedIds  = [...new Set((failedLog  ?? []).map((s: any) => s.request_id as string))];

  const [{ data: notViewedReqs }, { data: failedReqs }] = await Promise.all([
    notViewIds.length > 0
      ? supabase.from("payment_requests").select("id, outstanding, clients(name)")
          .in("id", notViewIds).neq("status", "paid")
      : Promise.resolve({ data: [] }),
    failedIds.length > 0
      ? supabase.from("payment_requests").select("id, outstanding, clients(name)")
          .in("id", failedIds).neq("status", "paid")
      : Promise.resolve({ data: [] }),
  ]);

  const totalDue      = (dueToday   ?? []).reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const totalOverdue  = (overdueAll ?? []).reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const totalRecvd    = (paidToday  ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const paidYestCount = (paidYesterday ?? []).length;
  const notViewedCount = notViewIds.length;

  const overdueRows = (overdueAll ?? []).map((r: any) => {
    const days = Math.floor((Date.now() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
    return clientRow((r.clients as any)?.name ?? "Unknown", `${days} day${days !== 1 ? "s" : ""} overdue`, fmtMoney(Number(r.outstanding)), true);
  }).join("");
  const notViewedRows = (notViewedReqs ?? []).map((r: any) =>
    clientRow((r.clients as any)?.name ?? "Unknown", "Reminder sent — not yet viewed", fmtMoney(Number(r.outstanding)), true)
  ).join("");
  const failedRows = (failedReqs ?? []).map((r: any) =>
    clientRow((r.clients as any)?.name ?? "Unknown", "Message delivery failed", fmtMoney(Number(r.outstanding)), true)
  ).join("");
  const allAttentionRows = overdueRows + notViewedRows + failedRows;

  const allClear    = (dueToday ?? []).length === 0 && (overdueAll ?? []).length === 0 && (paidToday ?? []).length === 0;
  const totalAtStake = totalDue + totalOverdue;

  const body = `
    ${statsBox([
      { label: "Due today",      value: String((dueToday   ?? []).length), sub: fmtMoney(totalDue)     },
      { label: "Still overdue",  value: String((overdueAll ?? []).length), sub: totalOverdue > 0 ? fmtMoney(totalOverdue) : "—", red: (overdueAll ?? []).length > 0 },
      { label: "Received today", value: String((paidToday  ?? []).length), sub: fmtMoney(totalRecvd)   },
    ])}

    ${sentIds.length > 0 ? `
      ${sectionHeader("Yesterday's delivery funnel")}
      ${statsBox([
        { label: "Sent",       value: String(sentIds.length)   },
        { label: "Viewed",     value: String(viewedIds.size)   },
        { label: "Paid",       value: String(paidYestCount)    },
        { label: "Not viewed", value: String(notViewedCount)   },
      ])}
      ${notViewedCount > 0 ? `<p style="margin:-4px 0 8px;font-size:11px;color:#DC2626;text-align:center;">&#9888; ${notViewedCount} account${notViewedCount !== 1 ? "s" : ""} still haven't viewed their payment request</p>` : ""}
    ` : ""}

    ${allAttentionRows ? `
      ${alertHeader("Needs attention")}
      ${attentionBox(allAttentionRows)}
    ` : ""}

    ${(dueToday ?? []).length > 0 ? `
      ${sectionHeader("Due today — awaiting payment")}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(dueToday as any[]).map(r => clientRow((r.clients as any)?.name ?? "Unknown", "Due today", fmtMoney(Number(r.outstanding)))).join("")}
      </table>` : ""}

    ${(paidToday ?? []).length > 0 ? `
      ${sectionHeader("Received today")}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(paidToday as any[]).map(p => clientRow((p.clients as any)?.name ?? "Unknown", "Payment received", fmtMoney(Number(p.amount)))).join("")}
      </table>` : ""}

    ${allClear ? emptyState("Nothing to report today — all clear!") : ""}
    ${ctaButton("Open TrailBill Dashboard →", `${appUrl}/dashboard`)}
  `;

  const hasActivity = (dueToday ?? []).length > 0 || (overdueAll ?? []).length > 0 || (paidToday ?? []).length > 0 || sentIds.length > 0;

  return {
    html: emailBase({ title: "Daily Action Report", subtitle: todayLabel, businessName: bizName, body, logoUrl: bizLogo }),
    subject: `Daily Report — ${totalAtStake > 0 ? fmtMoney(totalAtStake) + " at stake today" : "All clear today"}`,
    periodLabel: todayLabel,
    skip: !hasActivity,
  };
}

// ── Weekly Performance Report ──────────────────────────────────────────────

export async function buildWeeklyReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bizId: string,
  bizName: string,
  appUrl: string,
  bizLogo?: string | null,
): Promise<{ html: string; subject: string; periodLabel: string; periodStart: string; periodEnd: string }> {
  const now       = new Date();
  const todaySast = now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const day       = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const weekStart = mon.toISOString().split("T")[0];
  const weekEnd   = sun.toISOString().split("T")[0];
  const weekLabel = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;

  const d7  = new Date(now); d7.setDate(now.getDate() - 7);
  const d30 = new Date(now); d30.setDate(now.getDate() - 30);
  const d7str  = d7.toISOString().split("T")[0];
  const d30str = d30.toISOString().split("T")[0];

  const [
    { data: requests },
    { data: payments },
    { data: overdue1to7 },
    { data: overdue8to30 },
    { data: overdue30plus },
    { data: remindersSent },
    { data: waDeliveredLog },
    { data: waReadLog },
  ] = await Promise.all([
    supabase.from("payment_requests")
      .select("total_due, outstanding, status, due_date, clients(name)")
      .eq("business_id", bizId).gte("due_date", weekStart).lte("due_date", weekEnd).order("due_date"),

    supabase.from("payments").select("amount, clients(name)")
      .eq("business_id", bizId).gte("payment_date", weekStart).lte("payment_date", weekEnd),

    supabase.from("payment_requests").select("outstanding")
      .eq("business_id", bizId).gte("due_date", d7str).lt("due_date", todaySast).neq("status", "paid"),

    supabase.from("payment_requests").select("outstanding")
      .eq("business_id", bizId).gte("due_date", d30str).lt("due_date", d7str).neq("status", "paid"),

    supabase.from("payment_requests").select("outstanding")
      .eq("business_id", bizId).lt("due_date", d30str).neq("status", "paid"),

    supabase.from("reminder_log").select("id, channel")
      .eq("business_id", bizId).gte("sent_at", weekStart).lte("sent_at", weekEnd + "T23:59:59"),

    supabase.from("payment_events").select("id")
      .eq("business_id", bizId).eq("event_type", "whatsapp_delivered").gte("created_at", weekStart),

    supabase.from("payment_events").select("id")
      .eq("business_id", bizId).eq("event_type", "whatsapp_read").gte("created_at", weekStart),
  ]);

  const reqs = requests ?? [];
  const pays = payments ?? [];
  const totalExpected = reqs.reduce((s: number, r: any) => s + Number(r.total_due), 0);
  const totalReceived = pays.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const pct   = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
  const paid    = reqs.filter((r: any) => r.status === "paid");
  const waiting = reqs.filter((r: any) => r.status !== "paid");

  const o1to7  = overdue1to7  ?? [];
  const o8to30 = overdue8to30 ?? [];
  const o30p   = overdue30plus ?? [];
  const o1to7Amt  = o1to7.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const o8to30Amt = o8to30.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const o30pAmt   = o30p.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const hasAging  = o1to7.length + o8to30.length + o30p.length > 0;

  const waReminders = (remindersSent ?? []).filter((r: any) => r.channel === "whatsapp").length;
  const waDelivered = (waDeliveredLog ?? []).length;
  const waRead      = (waReadLog      ?? []).length;
  const readRate    = waReminders > 0 ? Math.round((waRead / waReminders) * 100) : 0;

  const agingRows = [
    o30p.length   > 0 ? clientRow(`${o30p.length} account${o30p.length !== 1 ? "s" : ""}`,     "30+ days overdue",  fmtMoney(o30pAmt),   true)  : "",
    o8to30.length > 0 ? clientRow(`${o8to30.length} account${o8to30.length !== 1 ? "s" : ""}`, "8–30 days overdue", fmtMoney(o8to30Amt), true)  : "",
    o1to7.length  > 0 ? clientRow(`${o1to7.length} account${o1to7.length !== 1 ? "s" : ""}`,   "1–7 days overdue",  fmtMoney(o1to7Amt),  false) : "",
  ].join("");

  const body = `
    ${statsBox([
      { label: "Expected this week", value: fmtMoney(totalExpected) },
      { label: "Collected",          value: fmtMoney(totalReceived) },
      { label: "Collection rate",    value: `${pct}%`               },
    ])}
    ${progressBar(pct)}

    ${hasAging ? `${alertHeader("Overdue accounts")}${attentionBox(agingRows)}` : ""}

    ${waiting.length > 0 ? `
      ${sectionHeader(`Outstanding this week (${waiting.length})`)}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(waiting as any[]).map((r: any) => {
          const daysLate = Math.floor((Date.now() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
          const detail   = daysLate > 0 ? `${daysLate} day${daysLate !== 1 ? "s" : ""} late` : `Due ${fmtShort(r.due_date)}`;
          return clientRow((r.clients as any)?.name ?? "Unknown", detail, fmtMoney(Number(r.outstanding)), daysLate > 0);
        }).join("")}
      </table>` : ""}

    ${paid.length > 0 ? `
      ${sectionHeader(`Paid this week (${paid.length})`)}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(paid as any[]).map((r: any) => clientRow((r.clients as any)?.name ?? "Unknown", `Due ${fmtShort(r.due_date)}`, "Paid")).join("")}
      </table>` : ""}

    ${waDelivered > 0 ? `
      ${sectionHeader("WhatsApp effectiveness")}
      ${statsBox([
        { label: "Sent via WhatsApp", value: String(waReminders) },
        { label: "Delivered",         value: String(waDelivered) },
        { label: "Read",              value: String(waRead)      },
        { label: "Read rate",         value: `${readRate}%`     },
      ])}` : ""}

    ${reqs.length === 0 ? emptyState("No payment requests due this week.") : ""}
    ${ctaButton("Open TrailBill Dashboard →", `${appUrl}/dashboard`)}
  `;

  return {
    html: emailBase({ title: "Weekly Performance Report", subtitle: weekLabel, businessName: bizName, body, logoUrl: bizLogo }),
    subject: `Weekly Report — ${fmtMoney(totalReceived)} collected, ${pct}% of target`,
    periodLabel: weekLabel,
    periodStart: weekStart,
    periodEnd: weekEnd,
  };
}

// ── Monthly Business Review ─────────────────────────────────────────────────

export async function buildMonthlyReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bizId: string,
  bizName: string,
  appUrl: string,
  bizLogo?: string | null,
): Promise<{ html: string; subject: string; periodLabel: string; periodStart: string; periodEnd: string; stats: Record<string, number> }> {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1;
  const monthStart = `${yr}-${String(mo).padStart(2, "0")}-01`;
  const lastDay    = new Date(yr, mo, 0).getDate();
  const monthEnd   = `${yr}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const periodLabel = `${MONTHS[mo - 1]} ${yr}`;

  const pYr = mo === 1 ? yr - 1 : yr;
  const pMo = mo === 1 ? 12 : mo - 1;
  const prevStart = `${pYr}-${String(pMo).padStart(2, "0")}-01`;
  const prevEnd   = `${pYr}-${String(pMo).padStart(2, "0")}-${String(new Date(pYr, pMo, 0).getDate()).padStart(2, "0")}`;

  const [
    { data: requests },
    { data: payments },
    { data: remindersData },
    { data: prevPayments },
    { data: prevRequests },
    { data: flags },
    { data: commitmentData },
  ] = await Promise.all([
    supabase.from("payment_requests")
      .select("total_due, amount_paid, outstanding, status, due_date, clients(name)")
      .eq("business_id", bizId).gte("due_date", monthStart).lte("due_date", monthEnd),

    supabase.from("payments").select("amount, clients(name)")
      .eq("business_id", bizId).gte("payment_date", monthStart).lte("payment_date", monthEnd),

    supabase.from("reminder_log").select("id").eq("business_id", bizId).eq("status", "sent")
      .gte("sent_at", monthStart).lte("sent_at", monthEnd + "T23:59:59"),

    supabase.from("payments").select("amount")
      .eq("business_id", bizId).gte("payment_date", prevStart).lte("payment_date", prevEnd),

    supabase.from("payment_requests").select("total_due")
      .eq("business_id", bizId).gte("due_date", prevStart).lte("due_date", prevEnd),

    supabase.from("behavior_flags").select("flag_type, clients(name)")
      .eq("business_id", bizId).in("flag_type", ["first_miss", "needs_attention"])
      .eq("is_read", false).limit(5),

    supabase.from("payment_requests").select("id, committed_date")
      .eq("business_id", bizId).neq("status", "scheduled")
      .gte("created_at", monthStart).lte("created_at", monthEnd + "T23:59:59"),
  ]);

  const reqs    = requests ?? [];
  const pays    = payments ?? [];
  const totalReminders = remindersData?.length ?? 0;
  const minutesSaved   = totalReminders * 8;
  const hoursSaved     = minutesSaved >= 60 ? (minutesSaved / 60).toFixed(1) : `${minutesSaved} min`;

  const commitReqs = commitmentData ?? [];
  const commitTotal = commitReqs.length;
  const commitCount = commitReqs.filter((r: any) => r.committed_date != null).length;
  const commitRate  = commitTotal > 0 ? Math.round((commitCount / commitTotal) * 100) : null;

  const totalExpected = reqs.reduce((s: number, r: any) => s + Number(r.total_due), 0);
  const totalReceived = pays.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const stillOwed     = reqs.filter((r: any) => r.status !== "paid").reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const pct           = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const prevExpected = (prevRequests ?? []).reduce((s: number, r: any) => s + Number(r.total_due), 0);
  const prevReceived = (prevPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const prevPct      = prevExpected > 0 ? Math.round((prevReceived / prevExpected) * 100) : 0;
  const trendLabel   = prevPct > 0 ? `${pct >= prevPct ? "▲" : "▼"} ${Math.abs(pct - prevPct)}% vs ${MONTHS[pMo - 1]}` : "";

  const paid    = reqs.filter((r: any) => r.status === "paid");
  const waiting = reqs.filter((r: any) => r.status !== "paid");
  const topRisk = [...waiting].sort((a: any, b: any) => Number(b.outstanding) - Number(a.outstanding)).slice(0, 3);

  const FLAG_FRIENDLY: Record<string, string> = {
    first_miss: "First payment missed", needs_attention: "Needs attention",
  };

  const riskRows = topRisk.map((r: any) => {
    const daysLate = Math.floor((now.getTime() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
    const detail   = daysLate > 0
      ? `${daysLate} day${daysLate !== 1 ? "s" : ""} overdue`
      : `Due ${new Date(r.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`;
    return clientRow((r.clients as any)?.name ?? "Unknown", detail, fmtMoney(Number(r.outstanding)), daysLate > 0);
  }).join("");

  const body = `
    ${totalReminders > 0 ? impactBanner({ reminders: totalReminders, hoursSaved }) : ""}

    ${statsBox([
      { label: "Expected",   value: fmtMoney(totalExpected) },
      { label: "Collected",  value: fmtMoney(totalReceived), sub: trendLabel },
      { label: "Still owed", value: fmtMoney(stillOwed),     red: stillOwed > 0 },
      { label: "Rate",       value: `${pct}%`               },
    ])}
    ${progressBar(pct)}

    ${commitRate !== null ? `
      ${sectionHeader("Client commitment rate")}
      ${statsBox([
        { label: "Requests sent",    value: String(commitTotal) },
        { label: "Clients committed", value: String(commitCount) },
        { label: "Commitment rate",   value: `${commitRate}%`, sub: commitRate >= 70 ? "Excellent" : commitRate >= 40 ? "Good" : "Needs attention" },
      ])}
      <p style="margin:0 0 16px;font-size:12px;color:#6b7280;text-align:center;">
        ${commitRate}% of your clients committed to their own payment date this month.
      </p>` : ""}

    ${riskRows ? `${alertHeader("Top accounts at risk")}${attentionBox(riskRows)}` : ""}

    ${paid.length > 0 ? `
      ${sectionHeader(`Paid this month (${paid.length})`)}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(paid as any[]).map((r: any) => clientRow(
          (r.clients as any)?.name ?? "Unknown",
          `Due ${new Date(r.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`,
          fmtMoney(Number(r.amount_paid))
        )).join("")}
      </table>` : ""}

    ${waiting.length > 0 ? `
      ${sectionHeader(`Still outstanding (${waiting.length})`)}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(waiting as any[]).map((r: any) => {
          const daysLate = Math.floor((now.getTime() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
          const detail   = daysLate > 0
            ? `${daysLate} day${daysLate !== 1 ? "s" : ""} late`
            : `Due ${new Date(r.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`;
          return clientRow((r.clients as any)?.name ?? "Unknown", detail, fmtMoney(Number(r.outstanding)), daysLate > 0);
        }).join("")}
      </table>` : ""}

    ${(flags ?? []).length > 0 ? `
      ${alertHeader("Clients needing attention")}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${(flags as any[]).map((f: any) => clientRow((f.clients as any)?.name ?? "Unknown", FLAG_FRIENDLY[f.flag_type] ?? f.flag_type, "")).join("")}
      </table>` : ""}

    ${reqs.length === 0 ? emptyState("No payment requests for this month yet.") : ""}
    ${ctaButton("Open TrailBill Dashboard →", `${appUrl}/dashboard`)}
  `;

  const stats = { expected: totalExpected, received: totalReceived, owed: stillOwed, rate: pct, reminders: totalReminders };

  return {
    html: emailBase({ title: "Monthly Business Review", subtitle: periodLabel, businessName: bizName, body, logoUrl: bizLogo }),
    subject: `${periodLabel} Collections Review — ${fmtMoney(totalReceived)} in, ${pct}% success`,
    periodLabel,
    periodStart: monthStart,
    periodEnd: monthEnd,
    stats,
  };
}
