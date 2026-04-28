import { Building2, Users, UserPlus, ChevronRight, Zap, TrendingUp, AlertTriangle, DollarSign, Clock } from "lucide-react";
import { DismissRefillButton } from "@/components/admin/dismiss-refill-button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminOverview() {
  const supabase = await createClient();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const in7Days  = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  const [
    { data: businesses },
    { data: leads },
    { data: refillRequests },
    { data: requests },
    { data: proposalsAll },
    { data: payEvents },
    { data: paymentsAll },
  ] = await Promise.all([
    supabase.from("businesses").select("id, name, email, created_at, subscription_active, subscription_end, credits_remaining, credits_monthly").order("created_at", { ascending: false }),
    supabase.from("leads").select("id, name, email, business_type, created_at, status").order("created_at", { ascending: false }).limit(10),
    supabase.from("refill_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("payment_requests").select("id, outstanding, status, committed_date"),
    supabase.from("proposals").select("id, status, viewed_at, view_count, allow_counter"),
    supabase.from("payment_events").select("request_id, event_type, created_at").in("event_type", ["reminder_sent", "payment_recorded"]),
    supabase.from("payments").select("amount"),
  ]);

  const allBiz        = businesses ?? [];
  const allLeads      = leads ?? [];
  const allRequests   = requests ?? [];
  const allProposals  = proposalsAll ?? [];
  const allEvents     = payEvents ?? [];
  const allPayments   = paymentsAll ?? [];
  const pendingLeads   = allLeads.filter(l => l.status === "pending");
  const pendingRefills = refillRequests ?? [];

  // Subscription health
  const activeSubs   = allBiz.filter(b => b.subscription_active).length;
  const expiredSubs  = allBiz.filter(b => !b.subscription_active && b.subscription_end).length;
  const expiringSoon = allBiz.filter(b =>
    b.subscription_active &&
    b.subscription_end &&
    b.subscription_end >= todayStr &&
    b.subscription_end <= in7DaysStr
  ).length;

  // Platform money
  const totalOutstanding = allRequests
    .filter(r => !["paid"].includes(r.status))
    .reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
  const totalCollected = allPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  // Credits consumed across all active businesses
  const creditsConsumed = allBiz
    .filter(b => b.subscription_active)
    .reduce((s, b) => s + ((b.credits_monthly ?? 100) - (b.credits_remaining ?? 0)), 0);

  // ── Requests ──────────────────────────────────────────────
  const requestsSent      = allRequests.length;
  const committedCount    = allRequests.filter(r => r.status === "committed").length;
  const paidRequests      = allRequests.filter(r => r.status === "paid");
  const paidTotal         = paidRequests.length;
  const paidDirect        = paidRequests.filter(r => !r.committed_date).length;  // paid with no commit date
  const paidAfterCommit   = paidTotal - paidDirect;
  const paidDirectPct     = paidTotal > 0 ? Math.round((paidDirect    / paidTotal) * 100) : 0;
  const paidAfterCommitPct = paidTotal > 0 ? Math.round((paidAfterCommit / paidTotal) * 100) : 0;

  // ── Proposals ─────────────────────────────────────────────
  const propTotal         = allProposals.length;
  const propOpened        = allProposals.filter(p => p.viewed_at).length;
  const propAccepted      = allProposals.filter(p => p.status === "accepted").length;
  const propCounter       = allProposals.filter(p => p.status === "revised_requested").length;
  const propPending       = allProposals.filter(p => p.status === "viewed").length;
  const propExpiredSeen   = allProposals.filter(p => p.status === "expired" && p.viewed_at).length;
  const propExpiredUnseen = allProposals.filter(p => p.status === "expired" && !p.viewed_at).length;
  // Rates: denominator = propTotal (consistent — all sent)
  const propOpenRate      = propTotal > 0 ? Math.round((propOpened    / propTotal) * 100) : 0;
  const propAcceptRate    = propTotal > 0 ? Math.round((propAccepted  / propTotal) * 100) : 0;
  const propCounterRate   = propTotal > 0 ? Math.round((propCounter   / propTotal) * 100) : 0;
  const propExpiredRate   = propTotal > 0 ? Math.round(((propExpiredSeen + propExpiredUnseen) / propTotal) * 100) : 0;
  // Accept rate of those who actually opened (conversion quality)
  const propAcceptOfOpened = propOpened > 0 ? Math.round((propAccepted / propOpened) * 100) : 0;
  const avgViews          = propOpened > 0
    ? (allProposals.reduce((s, p) => s + (p.view_count ?? 0), 0) / propOpened).toFixed(1)
    : "0";

  // Payment behaviour analysis from payment_events
  type ReqEvents = { reminders: string[]; paidAt: string | null };
  const byRequest = new Map<string, ReqEvents>();
  for (const e of allEvents) {
    if (!byRequest.has(e.request_id)) byRequest.set(e.request_id, { reminders: [], paidAt: null });
    const entry = byRequest.get(e.request_id)!;
    if (e.event_type === "payment_recorded") entry.paidAt = e.created_at;
    else entry.reminders.push(e.created_at);
  }
  let bhv0 = 0, bhv1 = 0, bhv2plus = 0;
  for (const { reminders, paidAt } of byRequest.values()) {
    if (!paidAt) continue;
    const before = reminders.filter(r => r < paidAt).length;
    if (before === 0) bhv0++;
    else if (before === 1) bhv1++;
    else bhv2plus++;
  }
  const bhvTotal = bhv0 + bhv1 + bhv2plus;
  const pct = (n: number) => bhvTotal > 0 ? Math.round((n / bhvTotal) * 100) : 0;

  // Businesses needing action
  const expiredBizList   = allBiz.filter(b => !b.subscription_active && b.subscription_end);
  const expiringSoonList = allBiz.filter(b =>
    b.subscription_active &&
    b.subscription_end &&
    b.subscription_end >= todayStr &&
    b.subscription_end <= in7DaysStr
  );

  const fmt = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold mb-1">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">TrailBill admin at a glance</p>
      </div>

      {/* Intelligent action alerts */}
      {(expiredBizList.length > 0 || expiringSoonList.length > 0) && (
        <div className="space-y-2 mb-6">
          {expiredBizList.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-sm font-semibold text-destructive">{b.name}</span>
                <span className="text-xs text-muted-foreground">— subscription expired {b.subscription_end}</span>
              </div>
              <Link href="/admin/businesses" className="text-xs font-semibold text-destructive underline">Renew →</Link>
            </div>
          ))}
          {expiringSoonList.map(b => {
            const daysLeft = Math.ceil((new Date(b.subscription_end).getTime() - new Date(todayStr).getTime()) / 86400000);
            return (
              <div key={b.id} className="flex items-center justify-between bg-amber-500/5 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{b.name}</span>
                  <span className="text-xs text-muted-foreground">— expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>
                </div>
                <Link href="/admin/businesses" className="text-xs font-semibold text-amber-600 underline">Renew →</Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription health */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Subscription health</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold leading-tight text-emerald-600">{activeSubs}</p>
          </div>
        </div>
        <div className={`bg-card rounded-xl border p-4 flex items-center gap-3 ${expiringSoon > 0 ? "border-amber-300 dark:border-amber-700" : "border-border"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${expiringSoon > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
            <Clock className={`w-5 h-5 ${expiringSoon > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expiring ≤7d</p>
            <p className={`text-2xl font-bold leading-tight ${expiringSoon > 0 ? "text-amber-600" : ""}`}>{expiringSoon}</p>
          </div>
        </div>
        <div className={`bg-card rounded-xl border p-4 flex items-center gap-3 ${expiredSubs > 0 ? "border-destructive/30" : "border-border"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${expiredSubs > 0 ? "bg-destructive/10" : "bg-muted"}`}>
            <AlertTriangle className={`w-5 h-5 ${expiredSubs > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expired</p>
            <p className={`text-2xl font-bold leading-tight ${expiredSubs > 0 ? "text-destructive" : ""}`}>{expiredSubs}</p>
          </div>
        </div>
        <div className={`bg-card rounded-xl border p-4 flex items-center gap-3 ${pendingRefills.length > 0 ? "border-primary/30" : "border-border"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${pendingRefills.length > 0 ? "bg-primary/10" : "bg-muted"}`}>
            <Zap className={`w-5 h-5 ${pendingRefills.length > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Refill Requests</p>
            <p className={`text-2xl font-bold leading-tight ${pendingRefills.length > 0 ? "text-primary" : ""}`}>{pendingRefills.length}</p>
          </div>
        </div>
      </div>

      {/* Platform money */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">Money on the platform</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold leading-tight">{fmt(totalOutstanding)}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-lg font-bold leading-tight text-emerald-600">{fmt(totalCollected)}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Credits used</p>
            <p className="text-2xl font-bold leading-tight">{creditsConsumed}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Leads</p>
            <p className="text-2xl font-bold leading-tight">{pendingLeads.length}</p>
          </div>
        </div>
      </div>

      {/* Engagement */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">Engagement</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Requests sent</p>
          <p className="text-2xl font-bold">{requestsSent}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{committedCount} still committed</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Proposals sent</p>
          <p className="text-2xl font-bold">{propTotal}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{propAccepted} accepted ({propAcceptRate}% of sent)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Paid without committing</p>
          <p className="text-2xl font-bold text-emerald-600">{paidDirectPct}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{paidDirect} of {paidTotal} paid directly</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Paid after committing</p>
          <p className="text-2xl font-bold text-amber-600">{paidAfterCommitPct}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{paidAfterCommit} of {paidTotal} negotiated first</p>
        </div>
      </div>

      {/* Payment behaviour by reminders */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">Payment behaviour</p>
      <div className="grid gap-3 grid-cols-3 mb-6">
        <div className="bg-card rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-xs text-muted-foreground mb-1">Paid on first send</p>
          <p className="text-2xl font-bold text-emerald-600">{pct(bhv0)}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{bhv0} clients — no reminders needed</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-muted-foreground mb-1">Paid after 1 reminder</p>
          <p className="text-2xl font-bold text-amber-600">{pct(bhv1)}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{bhv1} clients — needed one nudge</p>
        </div>
        <div className="bg-card rounded-xl border border-destructive/20 p-4">
          <p className="text-xs text-muted-foreground mb-1">Paid after 2+ reminders</p>
          <p className="text-2xl font-bold text-destructive">{pct(bhv2plus)}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{bhv2plus} clients — needed multiple follow-ups</p>
        </div>
      </div>

      {/* Proposal funnel */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-5">Proposal funnel</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-2">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Open rate</p>
          <p className="text-2xl font-bold">{propOpenRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{propOpened} of {propTotal} opened · avg {avgViews}x views</p>
        </div>
        <div className="bg-card rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-xs text-muted-foreground mb-1">Accepted (of sent)</p>
          <p className="text-2xl font-bold text-emerald-600">{propAcceptRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{propAccepted} accepted · {propAcceptOfOpened}% of opened</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-muted-foreground mb-1">Counter-offered (of sent)</p>
          <p className="text-2xl font-bold text-amber-600">{propCounterRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{propCounter} clients · {propPending} still pending</p>
        </div>
        <div className="bg-card rounded-xl border border-destructive/20 p-4">
          <p className="text-xs text-muted-foreground mb-1">Expired (of sent)</p>
          <p className="text-2xl font-bold text-destructive">{propExpiredRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{propExpiredSeen} seen · {propExpiredUnseen} never opened</p>
        </div>
      </div>

      {pendingRefills.length > 0 && (
        <div className="bg-card rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Pending Refill Requests ({pendingRefills.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {pendingRefills.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.business_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.pack_label} · {r.pack_credits} credits · {r.pack_price}
                    {r.contact_phone && ` · 📞 ${r.contact_phone}`}
                  </p>
                  {r.message && <p className="text-xs text-muted-foreground italic mt-0.5">&ldquo;{r.message}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-ZA")}</span>
                  <DismissRefillButton id={r.id} businessName={r.business_name} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent businesses */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Businesses ({allBiz.length})</h3>
            <Link href="/admin/businesses" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {allBiz.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No businesses yet</p>
          ) : (
            <div className="divide-y divide-border">
              {allBiz.slice(0, 10).map(biz => (
                <div key={biz.id} className="flex items-center gap-3 px-5 py-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{biz.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{biz.email ?? "No email"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(biz.created_at).toLocaleDateString("en-ZA")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending leads */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pending Leads ({pendingLeads.length})</h3>
            <Link href="/admin/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
              All leads <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending leads</p>
          ) : (
            <div className="divide-y divide-border">
              {pendingLeads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.business_type ?? "New lead"} · {new Date(lead.created_at).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                  <Link href="/admin/leads" className="text-xs text-primary hover:underline font-medium">Convert</Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
