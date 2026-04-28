import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, Bell, Eye, XCircle } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/dashboard/print-button";
import { PrintableReportShell } from "@/components/dashboard/printable-report";

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DailyDigestPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams;
  const now = dateParam ? new Date(dateParam + "T00:00:00") : new Date();
  const today = dateParam ?? now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const isPast = dateParam && dateParam < new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const todayLabel = now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const yd = new Date(now); yd.setDate(now.getDate() - 1);
  const yesterday = yd.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const ydStart   = `${yesterday}T00:00:00+02:00`;
  const ydEnd     = `${today}T00:00:00+02:00`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: business } = await supabase.from("businesses").select("id, name, logo_url").eq("owner_id", user?.id ?? "").single();
  const businessId = business?.id ?? "";

  const [
    { data: rawDue }, { data: rawOverdue }, { data: rawPaidToday },
    { data: rawFlags }, { data: rawSentLog }, { data: rawViewedLog },
    { data: rawPaidYd }, { data: rawFailedLog },
  ] = await Promise.all([
    businessId ? supabase.from("payment_requests")
      .select("id, total_due, outstanding, status, due_date, clients(name)")
      .eq("business_id", businessId).eq("due_date", today).neq("status", "paid") : { data: [] },
    businessId ? supabase.from("payment_requests")
      .select("id, outstanding, due_date, clients(name)")
      .eq("business_id", businessId).lt("due_date", today).neq("status", "paid").order("due_date") : { data: [] },
    businessId ? supabase.from("payments")
      .select("id, amount, clients(name)")
      .eq("business_id", businessId).eq("payment_date", today) : { data: [] },
    businessId ? supabase.from("behavior_flags")
      .select("id, flag_type, clients(name)").eq("business_id", businessId)
      .eq("is_read", false).in("severity", ["critical", "warning"]).limit(5) : { data: [] },
    businessId ? supabase.from("reminder_log").select("request_id")
      .eq("business_id", businessId).gte("sent_at", ydStart).lt("sent_at", ydEnd) : { data: [] },
    businessId ? supabase.from("payment_events").select("request_id")
      .eq("business_id", businessId)
      .in("event_type", ["link_visited", "pay_now_clicked", "whatsapp_read", "email_opened"])
      .gte("created_at", ydStart).lt("created_at", ydEnd) : { data: [] },
    businessId ? supabase.from("payments").select("amount")
      .eq("business_id", businessId).eq("payment_date", yesterday) : { data: [] },
    businessId ? supabase.from("reminder_log").select("request_id")
      .eq("business_id", businessId).eq("provider_status", "failed").gte("sent_at", ydStart) : { data: [] },
  ]);

  const dueToday  = rawDue    ?? [];
  const overdue   = rawOverdue ?? [];
  const paidToday = rawPaidToday ?? [];
  const flags     = rawFlags  ?? [];

  const sentIds   = [...new Set((rawSentLog ?? []).map((s: any) => s.request_id as string))];
  const viewedIds = new Set((rawViewedLog ?? []).map((e: any) => e.request_id as string));
  const notViewedIds = sentIds.filter(id => !viewedIds.has(id));
  const failedIds = [...new Set((rawFailedLog ?? []).map((s: any) => s.request_id as string))];
  const paidYdCount = (rawPaidYd ?? []).length;

  const notViewedReqs = notViewedIds.length > 0
    ? (await supabase.from("payment_requests").select("id, outstanding, clients(name)").in("id", notViewedIds).neq("status", "paid")).data ?? []
    : [];
  const failedReqs = failedIds.length > 0
    ? (await supabase.from("payment_requests").select("id, outstanding, clients(name)").in("id", failedIds).neq("status", "paid")).data ?? []
    : [];

  const totalDueToday   = dueToday.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const totalOverdue    = overdue.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const totalRecvdToday = paidToday.reduce((s: number, p: any) => s + Number(p.amount), 0);

  const allAttention = [...overdue, ...notViewedReqs, ...failedReqs];
  const hasFunnel = sentIds.length > 0;

  const FLAG_FRIENDLY: Record<string, string> = {
    first_miss: "First payment issue", needs_attention: "Needs attention",
    watch: "Worth watching", reliable: "Paying on time", improving: "Improving",
  };

  return (
    <PrintableReportShell
      title="Daily Digest"
      period={todayLabel}
      businessName={business?.name ?? ""}
      logoUrl={(business as any)?.logo_url}
    >
    <div className="p-4 lg:p-6 print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-muted-foreground hover:text-foreground print:hidden">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Daily Digest {isPast && <span className="text-sm font-normal text-muted-foreground ml-1">(Past)</span>}</h2>
            <p className="text-sm text-muted-foreground">{business?.name} · {todayLabel}</p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{paidToday.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Paid today</p>
          <p className="text-xs font-medium text-primary mt-0.5">{fmtMoney(totalRecvdToday)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{dueToday.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Due today</p>
          <p className="text-xs font-medium mt-0.5">{fmtMoney(totalDueToday)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className={`text-2xl font-bold ${overdue.length > 0 ? "text-destructive" : "text-foreground"}`}>{overdue.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
          <p className={`text-xs font-medium mt-0.5 ${overdue.length > 0 ? "text-destructive" : ""}`}>{fmtMoney(totalOverdue)}</p>
        </div>
      </div>

      {/* Yesterday's Delivery Funnel */}
      {hasFunnel && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Yesterday&apos;s delivery funnel
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Sent",       value: sentIds.length,      color: "text-foreground" },
              { label: "Viewed",     value: viewedIds.size,      color: "text-primary" },
              { label: "Paid",       value: paidYdCount,         color: "text-primary" },
              { label: "Not viewed", value: notViewedIds.length,  color: notViewedIds.length > 0 ? "text-destructive" : "text-foreground" },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          {notViewedIds.length > 0 && (
            <p className="text-xs text-destructive font-medium mt-3 text-center">
              ⚠ {notViewedIds.length} account{notViewedIds.length !== 1 ? "s" : ""} haven&apos;t viewed their payment request yet
            </p>
          )}
        </div>
      )}

      {/* Needs Attention — red */}
      {allAttention.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Needs attention</h3>
            <span className="ml-auto text-[11px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
              {allAttention.length} item{allAttention.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-red-200 dark:divide-red-900">
            {overdue.map((r: any) => {
              const daysLate = Math.floor((now.getTime() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
              return (
                <div key={`ov-${r.id}`} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                    <p className="text-xs text-red-600">{daysLate} day{daysLate !== 1 ? "s" : ""} overdue · due {fmtDate(r.due_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmtMoney(Number(r.outstanding))}</span>
                </div>
              );
            })}
            {notViewedReqs.map((r: any) => (
              <div key={`nv-${r.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                  <p className="text-xs text-red-600">Reminder sent — not yet viewed</p>
                </div>
                <span className="text-sm font-bold text-red-600">{fmtMoney(Number(r.outstanding))}</span>
              </div>
            ))}
            {failedReqs.map((r: any) => (
              <div key={`fail-${r.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Message delivery failed
                  </p>
                </div>
                <span className="text-sm font-bold text-red-600">{fmtMoney(Number(r.outstanding))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Payments received today */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Received today</h3>
          </div>
          {paidToday.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No payments received yet today</p>
          ) : (
            <div className="divide-y divide-border">
              {paidToday.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-medium">{(p.clients as any)?.name ?? "Unknown"}</p>
                  <span className="text-sm font-semibold text-primary">{fmtMoney(Number(p.amount))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                <p className="text-xs font-bold">Total today</p>
                <p className="text-xs font-bold text-primary">{fmtMoney(totalRecvdToday)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Due today */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Due today — awaiting payment</h3>
          </div>
          {dueToday.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nothing due today</p>
          ) : (
            <div className="divide-y divide-border">
              {dueToday.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                  <span className="text-sm font-semibold">{fmtMoney(Number(r.outstanding))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue detail */}
        {overdue.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">All overdue accounts</h3>
            </div>
            <div className="divide-y divide-border">
              {overdue.map((r: any) => {
                const daysLate = Math.floor((now.getTime() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                      <p className="text-xs text-destructive">{daysLate} day{daysLate !== 1 ? "s" : ""} late · due {fmtDate(r.due_date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">{fmtMoney(Number(r.outstanding))}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs font-bold text-destructive">Total overdue</p>
                <p className="text-xs font-bold text-destructive">{fmtMoney(totalOverdue)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Active alerts */}
        {flags.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold">Active alerts</h3>
            </div>
            <div className="divide-y divide-border">
              {flags.map((f: any) => (
                <div key={f.id} className="flex items-start gap-2.5 px-4 py-3">
                  <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{(f.clients as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">{FLAG_FRIENDLY[f.flag_type] ?? f.flag_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All clear */}
        {dueToday.length === 0 && overdue.length === 0 && paidToday.length === 0 && (
          <div className="lg:col-span-2 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">All clear today!</p>
            <p className="text-xs text-muted-foreground mt-1">No payments due, overdue, or alerts.</p>
          </div>
        )}

      </div>
    </div>
    </PrintableReportShell>
  );
}
