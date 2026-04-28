import { createClient } from "@/lib/supabase/server";
import { DollarSign, TrendingUp, Clock, Send, BarChart2 } from "lucide-react";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { AnalyticsRangePicker } from "@/components/admin/analytics-range-picker";
import { Suspense } from "react";

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return `${MO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function fmtR(n: number) {
  return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function linearProject(series: number[], steps = 3): number[] {
  if (series.length < 2) return Array(steps).fill(series[0] ?? 0);
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  series.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den !== 0 ? num / den : 0;
  return Array.from({ length: steps }, (_, i) => Math.max(0, Math.round(yMean + slope * (n + i - xMean))));
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const supabase = await createClient();

  const [
    { data: rawRequests },
    { data: rawPayments },
    { data: rawBusinesses },
    { data: rawProposals },
  ] = await Promise.all([
    supabase.from("payment_requests").select("id, total_due, outstanding, status, due_date, committed_date, created_at"),
    supabase.from("payments").select("amount, payment_date"),
    supabase.from("businesses").select("id, created_at"),
    supabase.from("proposals").select("id, status, created_at"),
  ]);

  const requests   = rawRequests   ?? [];
  const payments   = rawPayments   ?? [];
  const businesses = rawBusinesses ?? [];
  const proposals  = rawProposals  ?? [];

  const now      = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  // Determine how many months to show based on range param
  let monthCount: number;
  if (rangeParam === "all") {
    const allDates = [
      ...requests.map(r => r.created_at),
      ...payments.map(p => p.payment_date),
      ...businesses.map(b => b.created_at),
    ].filter(Boolean) as string[];
    const earliest = allDates.length > 0 ? allDates.sort()[0] : null;
    if (earliest) {
      const e = new Date(earliest);
      monthCount = (now.getFullYear() - e.getFullYear()) * 12 + (now.getMonth() - e.getMonth()) + 1;
      monthCount = Math.max(monthCount, 1);
    } else {
      monthCount = 12;
    }
  } else {
    monthCount = parseInt(rangeParam ?? "12", 10) || 12;
  }

  // Build ordered month keys
  const monthSlots = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - i), 1);
    return { key: monthKey(d), label: monthLabel(d) };
  });

  // ── Totals (KPI bar) ───────────────────────────────────────────
  const totalBilled      = requests.reduce((s, r) => s + Number(r.total_due ?? 0), 0);
  const totalCollected   = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalOutstanding = requests.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const totalPaid        = requests.filter(r => r.status === "paid").length;
  const totalOverdue     = requests.filter(r => r.status === "overdue" || (r.due_date && r.due_date < todayStr && r.status !== "paid")).length;
  const collectionRate   = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // ── Monthly money series ───────────────────────────────────────
  const moneyActual = monthSlots.map(({ key, label }) => ({
    month:       label,
    billed:      requests.filter(r => r.created_at?.startsWith(key)).reduce((s, r) => s + Number(r.total_due ?? 0), 0),
    collected:   payments.filter(p => p.payment_date?.startsWith(key)).reduce((s, p) => s + Number(p.amount ?? 0), 0),
    outstanding: requests.filter(r => r.created_at?.startsWith(key) && r.status !== "paid").reduce((s, r) => s + Number(r.outstanding ?? 0), 0),
    projected:   false,
  }));

  // 3-month linear projection appended
  const projBilled    = linearProject(moneyActual.map(m => m.billed));
  const projCollected = linearProject(moneyActual.map(m => m.collected));
  const projMonths    = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return monthLabel(d);
  });
  const moneyProjected = projMonths.map((month, i) => ({
    month,
    billed:      projBilled[i],
    collected:   projCollected[i],
    outstanding: 0,
    projected:   true,
  }));
  const money = [...moneyActual, ...moneyProjected];

  // ── Monthly request pipeline ───────────────────────────────────
  const reqSeries = monthSlots.map(({ key, label }) => {
    const mo = requests.filter(r => r.created_at?.startsWith(key));
    return {
      month:     label,
      sent:      mo.length,
      paid:      mo.filter(r => r.status === "paid").length,
      overdue:   mo.filter(r => r.status === "overdue").length,
      committed: mo.filter(r => r.committed_date).length,
    };
  });

  // ── Monthly proposal outcomes ──────────────────────────────────
  const propSeries = monthSlots.map(({ key, label }) => {
    const mo = proposals.filter(p => p.created_at?.startsWith(key));
    return {
      month:    label,
      sent:     mo.length,
      accepted: mo.filter(p => p.status === "accepted").length,
      counter:  mo.filter(p => p.status === "revised_requested").length,
      expired:  mo.filter(p => p.status === "expired").length,
    };
  });

  // ── Platform growth ────────────────────────────────────────────
  const growthSeries = monthSlots.map(({ key, label }) => ({
    month:      label,
    businesses: businesses.filter(b => b.created_at?.startsWith(key)).length,
    requests:   requests.filter(r => r.created_at?.startsWith(key)).length,
  }));

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            {rangeParam === "all" ? "All time" : `Last ${monthCount} months`} · real data + 3-month projection
          </p>
        </div>
        <Suspense>
          <AnalyticsRangePicker />
        </Suspense>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Total Billed</p></div>
          <p className="text-xl font-bold">{fmtR(totalBilled)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{requests.length} requests</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-xs text-muted-foreground">Collected</p></div>
          <p className="text-xl font-bold text-emerald-600">{fmtR(totalCollected)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{collectionRate}% collection rate</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><p className="text-xs text-muted-foreground">Outstanding</p></div>
          <p className="text-xl font-bold">{fmtR(totalOutstanding)}</p>
          <p className="text-[11px] text-destructive mt-0.5">{totalOverdue} overdue</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><Send className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Proposals</p></div>
          <p className="text-xl font-bold">{proposals.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{proposals.filter(p => p.status === "accepted").length} accepted</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><BarChart2 className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Paid requests</p></div>
          <p className="text-xl font-bold">{totalPaid}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{requests.length > 0 ? Math.round((totalPaid / requests.length) * 100) : 0}% of sent</p>
        </div>
      </div>

      <AnalyticsCharts
        money={money}
        requests={reqSeries}
        proposals={propSeries}
        growth={growthSeries}
      />
    </div>
  );
}
