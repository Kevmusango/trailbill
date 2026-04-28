import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, CalendarCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReportsMonthNav } from "@/components/dashboard/reports-month-nav";
import { CollapsibleReportList } from "@/components/dashboard/collapsible-report-list";
import { TrendChart, type TrendPoint } from "@/components/dashboard/trend-chart";
import { PrintButton } from "@/components/dashboard/print-button";
import { PrintableReportShell } from "@/components/dashboard/printable-report";

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const trendDate = new Date(year, month - 1, 1);
  trendDate.setMonth(trendDate.getMonth() - 5);
  const trendStart = `${trendDate.getFullYear()}-${String(trendDate.getMonth() + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: business } = await supabase.from("businesses").select("id, name, logo_url").eq("owner_id", user?.id ?? "").single();
  const businessId = business?.id ?? "";

  const [{ data: rawRequests }, { data: rawPayments }, { data: rawFlags }, { data: trendRaw }] = await Promise.all([
    businessId ? supabase.from("payment_requests")
      .select("id, total_due, amount_paid, outstanding, status, due_date, clients(name, reliability_score, average_days_to_pay)")
      .eq("business_id", businessId).gte("due_date", monthStart).lte("due_date", monthEnd).order("due_date") : { data: [] },
    businessId ? supabase.from("payments")
      .select("id, amount, payment_date, clients(name)")
      .eq("business_id", businessId).gte("payment_date", monthStart).lte("payment_date", monthEnd).order("payment_date", { ascending: false }) : { data: [] },
    businessId ? supabase.from("behavior_flags")
      .select("id, flag_type, clients(name)").eq("business_id", businessId).eq("is_read", false)
      .in("severity", ["critical", "warning"]).order("created_at", { ascending: false }).limit(5) : { data: [] },
    businessId ? supabase.from("payment_requests")
      .select("due_date, total_due, amount_paid, status").eq("business_id", businessId)
      .gte("due_date", trendStart).lte("due_date", monthEnd) : { data: [] },
  ]);

  const requests = rawRequests ?? [];
  const payments = rawPayments ?? [];
  const flags    = rawFlags ?? [];

  const totalExpected = requests.reduce((s, r) => s + Number(r.total_due), 0);
  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0);
  const stillOwed     = requests.filter(r => r.status !== "paid").reduce((s, r) => s + Number(r.outstanding), 0);
  const receivedPct   = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
  const paid    = requests.filter(r => r.status === "paid");
  const waiting = requests.filter(r => r.status !== "paid").sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const overdue = waiting.filter(r => new Date(r.due_date) < now);

  const statusLabel = (r: typeof requests[0]) => {
    const daysLate = Math.floor((now.getTime() - new Date(r.due_date).getTime()) / 86400000);
    if (r.status === "paid") return null;
    if (daysLate > 0) return { text: `${daysLate} day${daysLate !== 1 ? "s" : ""} late`, red: true };
    if (daysLate === 0) return { text: "Due today", red: false };
    return { text: `Due ${fmtDate(r.due_date)}`, red: false };
  };

  const reliabilityTrend = (score: number | null) => {
    if (!score) return null;
    if (score >= 4.5) return { icon: TrendingUp,   color: "text-primary",    label: "Reliable" };
    if (score >= 3.5) return { icon: TrendingUp,   color: "text-primary/70", label: "Good" };
    if (score >= 2.0) return { icon: Minus,        color: "text-amber-600",  label: "Watch" };
    return               { icon: TrendingDown, color: "text-destructive", label: "At risk" };
  };

  const FLAG_FRIENDLY: Record<string, string> = {
    first_miss: "First payment issue", needs_attention: "Needs your attention",
    watch: "Worth keeping an eye on", reliable: "Consistently paying on time", improving: "Getting better",
  };

  // Build trend
  const trendMap: Record<string, { expected: number; collected: number; paid: number; total: number }> = {};
  for (const r of (trendRaw ?? [])) {
    const d = new Date(r.due_date + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!trendMap[key]) trendMap[key] = { expected: 0, collected: 0, paid: 0, total: 0 };
    trendMap[key].expected  += Number(r.total_due);
    trendMap[key].collected += Number(r.amount_paid);
    trendMap[key].total++;
    if (r.status === "paid") trendMap[key].paid++;
  }
  const trendPoints: TrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = trendMap[key];
    const isFuture = d > now;
    trendPoints.push({
      label: MONTH_NAMES[d.getMonth()],
      collection_rate: !isFuture && entry && entry.expected > 0 ? Math.round((entry.collected / entry.expected) * 100) : (!isFuture && entry ? 0 : null),
      collected: entry?.collected ?? 0, expected: entry?.expected ?? 0,
      paid_count: entry?.paid ?? 0, total_count: entry?.total ?? 0,
    });
  }
  const hasTrend = trendPoints.some(p => p.collection_rate !== null);

  return (
    <PrintableReportShell
      title="Monthly Report"
      period={`${MONTH_LONG[month - 1]} ${year}`}
      businessName={business?.name ?? ""}
      logoUrl={(business as any)?.logo_url}
    >
    <div className="p-4 lg:p-6 print:p-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-muted-foreground hover:text-foreground print:hidden">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Monthly Report</h2>
            <p className="text-sm text-muted-foreground">{business?.name} · {MONTH_LONG[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <ReportsMonthNav year={year} month={month} basePath="/dashboard/reports/monthly" />
          <PrintButton />
        </div>
      </div>

      {/* Top accounts at risk */}
      {overdue.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Top accounts at risk</h3>
            <span className="ml-auto text-[11px] font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
              {overdue.length} overdue · {fmtMoney(overdue.reduce((s, r) => s + Number((r as any).outstanding), 0))}
            </span>
          </div>
          <div className="divide-y divide-red-200 dark:divide-red-900">
            {[...overdue].sort((a: any, b: any) => Number(b.outstanding) - Number(a.outstanding)).slice(0, 5).map((r: any) => {
              const daysLate = Math.floor((now.getTime() - new Date(r.due_date + "T00:00:00").getTime()) / 86400000);
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                    <p className="text-xs text-red-600">{daysLate} day{daysLate !== 1 ? "s" : ""} overdue · due {fmtDate(r.due_date)}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmtMoney(Number(r.outstanding))}</span>
                </div>
              );
            })}
            {overdue.length > 5 && (
              <div className="px-4 py-2.5 text-center text-xs text-red-600 font-medium">
                +{overdue.length - 5} more overdue accounts — see &ldquo;Still waiting&rdquo; below
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend chart */}
      {hasTrend && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-5 print:border print:rounded-none">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Collection Rate — Last 6 Months</h3>
              <p className="text-xs text-muted-foreground">% of expected fees collected each month</p>
            </div>
            {(() => {
              const valid = trendPoints.filter(p => p.collection_rate !== null);
              if (valid.length < 2) return null;
              const diff = (valid[valid.length - 1].collection_rate as number) - (valid[0].collection_rate as number);
              if (diff === 0) return null;
              return (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${diff > 0 ? "text-primary" : "text-destructive"}`}>
                  {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {diff > 0 ? "+" : ""}{diff}% over 6 months
                </span>
              );
            })()}
          </div>
          <TrendChart data={trendPoints} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">

          {/* Who paid */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Who paid
              <span className="ml-auto text-xs font-normal text-muted-foreground">{paid.length} of {requests.length}</span>
            </h3>
            {paid.length > 0 ? (
              <CollapsibleReportList initialCount={8} totalLabel="people">
                {paid.map(r => {
                  const client = r.clients as any;
                  const trend = reliabilityTrend(client?.reliability_score ?? null);
                  const TIcon = trend?.icon;
                  return (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{client?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">Due {fmtDate(r.due_date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {TIcon && <span className={`hidden sm:flex text-xs items-center gap-0.5 ${trend.color}`}><TIcon className="w-3 h-3" />{trend.label}</span>}
                        <span className="text-sm font-semibold text-primary">{fmtMoney(Number(r.amount_paid))}</span>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleReportList>
            ) : (
              <div className="bg-muted/30 rounded-xl border border-border px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No payments received yet this month</p>
              </div>
            )}
          </div>

          {/* Still waiting */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Still waiting
              {overdue.length > 0 && <span className="ml-auto text-xs font-medium text-destructive">{overdue.length} overdue</span>}
            </h3>
            {waiting.length > 0 ? (
              <CollapsibleReportList initialCount={8} totalLabel="people">
                {waiting.map(r => {
                  const badge = statusLabel(r);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{(r.clients as any)?.name ?? "Unknown"}</p>
                        {badge && <p className={`text-xs font-medium ${badge.red ? "text-destructive" : "text-amber-600"}`}>{badge.text}</p>}
                      </div>
                      <span className={`text-sm font-semibold ${badge?.red ? "text-destructive" : "text-foreground"}`}>{fmtMoney(Number(r.outstanding))}</span>
                    </div>
                  );
                })}
              </CollapsibleReportList>
            ) : (
              <div className="bg-primary/5 rounded-xl border border-primary/20 px-4 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Everyone has paid this month!</p>
              </div>
            )}
          </div>

          {/* Payment log */}
          {payments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Payments received in {MONTH_LONG[month - 1]}
              </h3>
              <CollapsibleReportList initialCount={10} totalLabel="payments">
                {[...payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{(p.clients as any)?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{fmtMoney(Number(p.amount))}</span>
                  </div>
                )),
                <div key="__total" className="flex items-center justify-between px-4 py-3 bg-primary/5">
                  <p className="text-sm font-bold">Total received</p>
                  <p className="text-sm font-bold text-primary">{fmtMoney(totalReceived)}</p>
                </div>]}
              </CollapsibleReportList>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">{MONTH_LONG[month - 1]} Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Expected</span>
                <span className="text-sm font-bold">{fmtMoney(totalExpected)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Collected</span>
                <span className="text-sm font-bold text-primary">{fmtMoney(totalReceived)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Still owed</span>
                <span className={`text-sm font-bold ${stillOwed > 0 ? "text-destructive" : "text-primary"}`}>{fmtMoney(stillOwed)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Collection rate</span>
                <span className="font-semibold text-foreground">{receivedPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(receivedPct, 100)}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-primary">{paid.length}</p>
                <p className="text-[10px] text-muted-foreground">Paid</p>
              </div>
              <div className="bg-muted/40 rounded-xl px-3 py-2.5 text-center">
                <p className={`text-lg font-bold ${overdue.length > 0 ? "text-destructive" : "text-foreground"}`}>{waiting.length}</p>
                <p className="text-[10px] text-muted-foreground">Waiting</p>
              </div>
            </div>
          </div>

          {flags.length > 0 && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <h3 className="text-sm font-semibold">Things to check</h3>
              </div>
              <div className="divide-y divide-border">
                {flags.map((f: any) => (
                  <div key={f.id} className="flex items-start gap-2.5 px-4 py-3">
                    <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{(f.clients as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{FLAG_FRIENDLY[f.flag_type] ?? f.flag_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Stats</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Total clients</span>
              <span className="text-xs font-semibold">{requests.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" /> Overdue</span>
              <span className={`text-xs font-semibold ${overdue.length > 0 ? "text-destructive" : "text-primary"}`}>{overdue.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Payment entries</span>
              <span className="text-xs font-semibold">{payments.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PrintableReportShell>
  );
}
