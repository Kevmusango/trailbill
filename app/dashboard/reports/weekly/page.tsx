import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, CheckCircle2, Clock, TrendingUp, AlertTriangle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/dashboard/print-button";
import { PrintableReportShell } from "@/components/dashboard/printable-report";

function fmtMoney(n: number) {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: mon, end: sun };
}

export default async function WeeklyReportPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekParam } = await searchParams;
  let start: Date, end: Date;
  if (weekParam) {
    start = new Date(weekParam + "T00:00:00");
    end = new Date(start); end.setDate(start.getDate() + 6);
  } else {
    ({ start, end } = getWeekBounds());
  }
  const weekStart = start.toISOString().split("T")[0];
  const weekEnd   = end.toISOString().split("T")[0];
  const weekLabel = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;
  const isPast = weekParam && weekEnd < new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  const now = new Date();
  const todaySast = now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const d7  = new Date(now); d7.setDate(now.getDate() - 7);
  const d30 = new Date(now); d30.setDate(now.getDate() - 30);
  const d7str  = d7.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const d30str = d30.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: business } = await supabase.from("businesses").select("id, name, logo_url").eq("owner_id", user?.id ?? "").single();
  const businessId = business?.id ?? "";

  const [
    { data: rawRequests }, { data: rawPayments },
    { data: rawO1to7 }, { data: rawO8to30 }, { data: rawO30p },
    { data: rawWaSent }, { data: rawWaDelivered }, { data: rawWaRead },
  ] = await Promise.all([
    businessId ? supabase.from("payment_requests")
      .select("id, total_due, amount_paid, outstanding, status, due_date, clients(name, reliability_score)")
      .eq("business_id", businessId).gte("due_date", weekStart).lte("due_date", weekEnd).order("due_date") : { data: [] },
    businessId ? supabase.from("payments")
      .select("id, amount, payment_date, clients(name)")
      .eq("business_id", businessId).gte("payment_date", weekStart).lte("payment_date", weekEnd)
      .order("payment_date", { ascending: false }) : { data: [] },
    businessId ? supabase.from("payment_requests").select("outstanding")
      .eq("business_id", businessId).gte("due_date", d7str).lt("due_date", todaySast).neq("status", "paid") : { data: [] },
    businessId ? supabase.from("payment_requests").select("outstanding")
      .eq("business_id", businessId).gte("due_date", d30str).lt("due_date", d7str).neq("status", "paid") : { data: [] },
    businessId ? supabase.from("payment_requests").select("outstanding")
      .eq("business_id", businessId).lt("due_date", d30str).neq("status", "paid") : { data: [] },
    businessId ? supabase.from("reminder_log").select("id")
      .eq("business_id", businessId).eq("channel", "whatsapp")
      .gte("sent_at", weekStart).lte("sent_at", weekEnd + "T23:59:59") : { data: [] },
    businessId ? supabase.from("payment_events").select("id")
      .eq("business_id", businessId).eq("event_type", "whatsapp_delivered")
      .gte("created_at", weekStart) : { data: [] },
    businessId ? supabase.from("payment_events").select("id")
      .eq("business_id", businessId).eq("event_type", "whatsapp_read")
      .gte("created_at", weekStart) : { data: [] },
  ]);

  const requests = rawRequests ?? [];
  const payments = rawPayments ?? [];

  const totalExpected = requests.reduce((s: number, r: any) => s + Number(r.total_due), 0);
  const totalReceived = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const paid    = requests.filter((r: any) => r.status === "paid");
  const waiting = requests.filter((r: any) => r.status !== "paid");
  const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const o1to7  = rawO1to7  ?? [];
  const o8to30 = rawO8to30 ?? [];
  const o30p   = rawO30p   ?? [];
  const o1to7Amt  = o1to7.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const o8to30Amt = o8to30.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const o30pAmt   = o30p.reduce((s: number, r: any) => s + Number(r.outstanding), 0);
  const hasAging  = o1to7.length + o8to30.length + o30p.length > 0;

  const waSent      = (rawWaSent      ?? []).length;
  const waDelivered = (rawWaDelivered ?? []).length;
  const waRead      = (rawWaRead      ?? []).length;
  const readRate    = waSent > 0 ? Math.round((waRead / waSent) * 100) : 0;
  const hasWa       = waSent > 0;

  return (
    <PrintableReportShell
      title="Weekly Report"
      period={weekLabel}
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
            <h2 className="text-2xl font-bold">Weekly Report {isPast && <span className="text-sm font-normal text-muted-foreground ml-1">(Past)</span>}</h2>
            <p className="text-sm text-muted-foreground">{business?.name} · {weekLabel}</p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{fmtMoney(totalExpected)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Expected this week</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{fmtMoney(totalReceived)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Collected so far</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className={`text-2xl font-bold ${pct >= 80 ? "text-primary" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>{pct}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Collection rate</p>
        </div>
      </div>

      {/* Collection rate progress bar */}
      <div className="mb-5">
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-amber-500" : "bg-destructive"}`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 text-right">{pct}% of target collected</p>
      </div>

      {/* Overdue aging buckets */}
      {hasAging && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Overdue accounts</h3>
          </div>
          <div className="grid grid-cols-3 divide-x divide-red-200 dark:divide-red-900">
            {[
              { label: "30+ days",  count: o30p.length,   amount: o30pAmt,   urgent: true  },
              { label: "8–30 days", count: o8to30.length, amount: o8to30Amt, urgent: true  },
              { label: "1–7 days",  count: o1to7.length,  amount: o1to7Amt,  urgent: false },
            ].map(b => (
              <div key={b.label} className="p-4 text-center">
                <p className={`text-xl font-bold ${b.urgent && b.count > 0 ? "text-red-600" : b.count > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{b.count}</p>
                <p className="text-[11px] text-muted-foreground">{b.label}</p>
                {b.count > 0 && <p className={`text-xs font-semibold mt-0.5 ${b.urgent ? "text-red-600" : "text-amber-600"}`}>{fmtMoney(b.amount)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp effectiveness */}
      {hasWa && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            WhatsApp effectiveness this week
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Sent",      value: waSent,      color: "text-foreground" },
              { label: "Delivered", value: waDelivered, color: "text-primary" },
              { label: "Read",      value: waRead,      color: "text-primary" },
              { label: "Read rate", value: `${readRate}%`, color: readRate >= 60 ? "text-primary" : readRate >= 30 ? "text-amber-600" : "text-destructive" },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Due this week */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Due this week ({requests.length})</h3>
          </div>
          {requests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Nothing due this week</p>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{r.clients?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">Due {fmtDate(r.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "paid"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                    <span className={`text-sm font-semibold ${r.status === "paid" ? "text-primary" : ""}`}>
                      {fmtMoney(r.status === "paid" ? Number(r.amount_paid) : Number(r.outstanding))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments received */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Payments received ({payments.length})</h3>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No payments yet this week</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.clients?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{fmtMoney(Number(p.amount))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                <p className="text-xs font-bold">Total this week</p>
                <p className="text-xs font-bold text-primary">{fmtMoney(totalReceived)}</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
    </PrintableReportShell>
  );
}
