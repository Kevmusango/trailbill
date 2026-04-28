import { createClient } from "@/lib/supabase/server";
import {
  Lightbulb, TrendingUp, TrendingDown, Minus,
  Smartphone, Mail, Clock, CalendarCheck,
  AlertTriangle, ShieldCheck, Eye, Zap,
} from "lucide-react";
import { InsightsClientTable } from "@/components/dashboard/insights-client-table";
import { CollapsibleReportList } from "@/components/dashboard/collapsible-report-list";

const FLAG_LABEL: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  needs_attention: { label: "Needs attention",      color: "text-destructive",  icon: AlertTriangle },
  first_miss:      { label: "Had a first miss",     color: "text-amber-600",    icon: AlertTriangle },
  watch:           { label: "Worth watching",        color: "text-amber-600",    icon: Eye },
  reliable:        { label: "Paying reliably",       color: "text-primary",      icon: ShieldCheck },
  improving:       { label: "Getting better",        color: "text-primary",      icon: TrendingUp },
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email:     Mail,
  whatsapp:  Smartphone,
};

function ScoreDots({ score }: { score: number | null }) {
  if (!score) return <span className="text-xs text-muted-foreground/50">No history</span>;
  const s = Math.round(score);
  const color = s >= 4 ? "bg-primary" : s >= 3 ? "bg-amber-400" : "bg-destructive";
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < s ? color : "bg-muted"}`} />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Lightbulb; color: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, industry")
    .eq("owner_id", user?.id ?? "")
    .single();

  const businessId = business?.id ?? "";
  const businessIndustry = business?.industry ?? null;

  // All active clients with intelligence fields
  const { data: rawClients } = businessId
    ? await supabase
        .from("clients")
        .select("id, name, reliability_score, average_days_to_pay, inferred_payday_day, payday_confidence, preferred_channel, status, is_active")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("reliability_score", { ascending: true })
        .limit(500)
    : { data: [] };

  const clients = rawClients ?? [];

  // Payment events aggregated per client + per type
  const { data: rawEvents } = businessId
    ? await supabase
        .from("payment_events")
        .select("client_id, event_type, channel")
        .eq("business_id", businessId)
        .limit(2000)
    : { data: [] };

  const events = rawEvents ?? [];

  // Build per-client event map
  const eventMap: Record<string, { link_visited: number; pay_now_clicked: number; extra_days_requested: number; payment_recorded: number }> = {};
  for (const e of events) {
    if (!e.client_id) continue;
    if (!eventMap[e.client_id]) eventMap[e.client_id] = { link_visited: 0, pay_now_clicked: 0, extra_days_requested: 0, payment_recorded: 0 };
    const t = e.event_type as keyof typeof eventMap[string];
    if (t in eventMap[e.client_id]) eventMap[e.client_id][t]++;
  }

  // Channel breakdown
  const channelTotals: Record<string, number> = {};
  for (const e of events.filter(e => e.event_type === "payment_recorded")) {
    const ch = e.channel ?? "unknown";
    channelTotals[ch] = (channelTotals[ch] ?? 0) + 1;
  }
  const totalPayments = Object.values(channelTotals).reduce((s, v) => s + v, 0);

  // Behavior flags summary (all time, by type)
  const { data: rawFlags } = businessId
    ? await supabase
        .from("behavior_flags")
        .select("id, flag_type, severity, is_read, clients(name)")
        .eq("business_id", businessId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const flags = rawFlags ?? [];

  // Overview stats
  const totalClients    = clients.length;
  const reliable        = clients.filter(c => Number(c.reliability_score) >= 4).length;
  const needsAttention  = clients.filter(c => Number(c.reliability_score) < 2 && c.reliability_score !== null).length;
  const avgDays         = clients.filter(c => c.average_days_to_pay).length > 0
    ? Math.round(clients.reduce((s, c) => s + Number(c.average_days_to_pay ?? 0), 0) / clients.filter(c => c.average_days_to_pay).length)
    : null;

  const withPayday      = clients.filter(c => c.inferred_payday_day).length;
  const withChannel     = clients.filter(c => c.preferred_channel).length;

  // Industry benchmark for this business
  let normIndustry: string | null = null;
  if (businessIndustry) {
    const { data } = await supabase.rpc("normalize_industry", { raw: businessIndustry });
    normIndustry = data ?? null;
  }

  const [{ data: benchmark }, { count: industryCount }] = await Promise.all([
    normIndustry
      ? supabase.from("industry_benchmarks").select("*").eq("industry", normIndustry).single()
      : Promise.resolve({ data: null }),
    businessIndustry
      ? supabase.from("businesses").select("id", { count: "exact", head: true }).ilike("industry", businessIndustry)
      : Promise.resolve({ count: null }),
  ]);

  const { data: myPaymentStats } = businessId
    ? await supabase
        .from("payment_requests")
        .select("total_due, amount_paid")
        .eq("business_id", businessId)
    : { data: [] };

  const myStats = (() => {
    const reqs = myPaymentStats ?? [];
    const totalDue = reqs.reduce((s, r) => s + Number(r.total_due), 0);
    const totalPaid = reqs.reduce((s, r) => s + Number(r.amount_paid), 0);
    const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null;
    const reliableClients = clients.filter(c => Number(c.reliability_score) >= 4).length;
    const pctOnTime = clients.length > 0 ? Math.round((reliableClients / clients.length) * 100) : null;
    return { collectionRate, avgDays, pctOnTime };
  })();

  return (
    <div className="p-4 lg:p-6">

      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-primary" />
          Insights
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          What TrailBill has learned about how your clients pay
        </p>
      </div>

      {/* Overview strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active clients"       value={totalClients}  icon={Zap}          color="text-primary" />
        <StatCard label="Paying reliably"      value={reliable}      icon={ShieldCheck}  color="text-primary"
          sub={totalClients > 0 ? `${Math.round((reliable / totalClients) * 100)}% of your clients` : undefined} />
        <StatCard label="Need attention"       value={needsAttention} icon={AlertTriangle} color="text-destructive" />
        <StatCard label="Avg. days to pay"     value={avgDays !== null ? `${avgDays} days` : "—"}
          icon={Clock} color="text-amber-600"
          sub="from due date to payment" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">

        {/* Left col: client behaviour table */}
        <div className="lg:col-span-2 space-y-5">

          {/* Client behaviour */}
          <InsightsClientTable clients={clients} eventMap={eventMap} />

        </div>

        {/* Right col: flags + channel */}
        <div className="space-y-5">

          {/* Active alerts */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Active alerts</h3>
              <p className="text-xs text-muted-foreground">Unread flags across your clients</p>
            </div>
            {flags.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <ShieldCheck className="w-7 h-7 text-primary mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">No active alerts</p>
              </div>
            ) : (
              <CollapsibleReportList initialCount={6} totalLabel="alerts">
                {flags.map((f: any) => {
                  const def = FLAG_LABEL[f.flag_type] ?? { label: f.flag_type, color: "text-foreground", icon: AlertTriangle };
                  const Icon = def.icon;
                  return (
                    <div key={f.id} className="flex items-start gap-2.5 px-4 py-3">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${def.color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{(f.clients as any)?.name}</p>
                        <p className={`text-xs ${def.color}`}>{def.label}</p>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleReportList>
            )}
          </div>

          {/* Channel intelligence */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">How they pay</h3>
              <p className="text-xs text-muted-foreground">Which channel leads to payment</p>
            </div>
            <div className="px-4 py-4 space-y-3">
              {totalPayments === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Not enough data yet</p>
              ) : Object.entries(channelTotals)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([ch, count]) => {
                const pct = Math.round((count / totalPayments) * 100);
                const ChIcon = CHANNEL_ICON[ch] ?? Mail;
                return (
                  <div key={ch}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-1.5 capitalize">
                        <ChIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        {ch}
                      </span>
                      <span className="text-xs text-muted-foreground">{count} payment{count !== 1 ? "s" : ""} · {pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

            {/* Industry benchmark card */}
          {benchmark ? (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">How you compare</h3>
                <p className="text-xs text-muted-foreground">
                  vs. {benchmark.business_count} other {benchmark.industry} businesses
                </p>
              </div>
              <div className="divide-y divide-border">
                {[
                  {
                    label: "Collection rate",
                    mine: myStats.collectionRate !== null ? `${myStats.collectionRate}%` : null,
                    industry: `${benchmark.avg_collection_rate}%`,
                    better: myStats.collectionRate !== null && myStats.collectionRate > Number(benchmark.avg_collection_rate),
                  },
                  {
                    label: "Avg days to pay",
                    mine: myStats.avgDays !== null ? `${myStats.avgDays}d` : null,
                    industry: `${benchmark.avg_days_to_pay}d`,
                    better: myStats.avgDays !== null && myStats.avgDays < Number(benchmark.avg_days_to_pay),
                  },
                  {
                    label: "Clients on time",
                    mine: myStats.pctOnTime !== null ? `${myStats.pctOnTime}%` : null,
                    industry: `${benchmark.pct_clients_on_time}%`,
                    better: myStats.pctOnTime !== null && myStats.pctOnTime > Number(benchmark.pct_clients_on_time),
                  },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Industry avg</p>
                        <p className="text-xs font-medium">{row.industry}</p>
                      </div>
                      {row.mine !== null && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">You</p>
                          <p className={`text-xs font-bold ${row.better ? "text-primary" : "text-destructive"}`}>
                            {row.mine} {row.better ? "↑" : "↓"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-border">
                <p className="text-[10px] text-muted-foreground">
                  Anonymised · POPIA compliant · Updated nightly
                </p>
              </div>
            </div>
          ) : businessIndustry ? (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-xs font-semibold">Benchmark unlock progress</p>
                  <p className="text-[11px] text-muted-foreground">{businessIndustry}</p>
                </div>
                <span className="text-sm font-bold text-primary">{industryCount ?? 1}<span className="text-muted-foreground font-normal text-xs"> / 5</span></span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden my-2.5">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((industryCount ?? 1) / 5) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {(industryCount ?? 1) >= 5
                  ? "Benchmark ready — refreshes nightly."
                  : `${5 - (industryCount ?? 1)} more ${businessIndustry} business${5 - (industryCount ?? 1) !== 1 ? "es" : ""} needed to unlock your industry comparison.`}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">Anonymised · POPIA compliant</p>
            </div>
          ) : null}

        {/* Payday intelligence */}
          {withPayday > 0 && (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Payday patterns</h3>
                <p className="text-xs text-muted-foreground">
                  Learned from {withPayday} of {totalClients} clients
                </p>
              </div>
              <CollapsibleReportList initialCount={8} totalLabel="clients">
                {clients
                  .filter(c => c.inferred_payday_day)
                  .sort((a, b) => (a.inferred_payday_day ?? 0) - (b.inferred_payday_day ?? 0))
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-sm truncate flex-1 min-w-0 mr-3">{c.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {c.payday_confidence != null ? `${Math.round(Number(c.payday_confidence) * 100)}% sure` : ""}
                        </span>
                        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          ~{c.inferred_payday_day}{["st","nd","rd"][((c.inferred_payday_day! % 10) - 1)] ?? "th"}
                        </span>
                      </div>
                    </div>
                  ))}
              </CollapsibleReportList>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
