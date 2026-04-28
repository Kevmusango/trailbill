import Link from "next/link";
import { DollarSign, AlertCircle, CheckCircle2, Send, FileText, AlertTriangle, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSubscriptionStatus } from "@/lib/subscription";
import { RequestRefillModal } from "@/components/dashboard/request-refill-modal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, credits_remaining, credits_monthly, subscription_active, subscription_start, subscription_days")
    .eq("owner_id", user?.id ?? "")
    .single();

  const businessId        = business?.id ?? "";
  const creditsRemaining  = business?.credits_remaining  ?? 0;
  const creditsMonthly    = business?.credits_monthly    ?? 100;
  const subscriptionActive = business?.subscription_active ?? false;
  const sub               = getSubscriptionStatus(business?.subscription_start ?? null, business?.subscription_days ?? 30);
  const isExpired        = !subscriptionActive && sub.hasSubscription;
  const creditsUsed       = isExpired ? 0 : creditsMonthly - creditsRemaining;
  const creditsPct        = isExpired ? 0 : (creditsMonthly > 0 ? Math.round((creditsRemaining / creditsMonthly) * 100) : 0);
  const resetLabel        = sub.expiresAt
    ? sub.expiresAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const { data: requests } = businessId
    ? await supabase
        .from("payment_requests")
        .select("id, total_due, amount_paid, outstanding, status, due_date, created_at, client_id, clients(name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const allRequests = requests ?? [];

  // Auto-mark overdue
  if (businessId && allRequests.length > 0) {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const overdueIds = allRequests
      .filter((r: any) => ["sent", "opened", "partial"].includes(r.status) && r.due_date < todayStr)
      .map((r: any) => r.id);
    if (overdueIds.length > 0) {
      await supabase.from("payment_requests").update({ status: "overdue" }).in("id", overdueIds);
      overdueIds.forEach((id: string) => {
        const r = allRequests.find((x: any) => x.id === id) as any;
        if (r) r.status = "overdue";
      });
    }
  }

  const totalOutstanding = allRequests
    .filter(r => r.status !== "paid")
    .reduce((sum, r) => sum + Number(r.outstanding), 0);

  const overdue = allRequests.filter(r => r.status === "overdue");
  const overdueTotal = overdue.reduce((sum, r) => sum + Number(r.outstanding), 0);

  const paidRequests = allRequests.filter(r => r.status === "paid");
  const paidTotal = paidRequests.reduce((sum, r) => sum + Number(r.amount_paid), 0);

  const recentRequests = allRequests.slice(0, 10);

  const statusColor: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    opened: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    scheduled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold">Dashboard</h2>
          <p className="text-xs text-muted-foreground">Payment requests overview</p>
        </div>
        <div className="flex items-center gap-2">
          {isExpired ? (
            <>
              <Button size="sm" variant="outline" className="gap-2 opacity-40 cursor-not-allowed" disabled>
                <FileText className="w-3.5 h-3.5" />
                Send Proposal
              </Button>
              <Button size="sm" className="gap-2 opacity-40 cursor-not-allowed" disabled>
                <Send className="w-3.5 h-3.5" />
                Send Request
              </Button>
            </>
          ) : (
            <>
              <Link href="/dashboard/proposals" className="flex-1 sm:flex-none">
                <Button size="sm" variant="outline" className="gap-2 w-full sm:w-auto">
                  <FileText className="w-3.5 h-3.5" />
                  Send Proposal
                </Button>
              </Link>
              <Link href="/dashboard/payments/send" className="flex-1 sm:flex-none">
                <Button size="sm" className="gap-2 w-full sm:w-auto">
                  <Send className="w-3.5 h-3.5" />
                  Send Request
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Subscription expired banner */}
      {isExpired && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Your plan has expired</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sending is paused until your plan is renewed. Your existing reminders still run. <a href="mailto:support@trailbill.com" className="underline text-foreground">Contact support to renew.</a></p>
          </div>
        </div>
      )}

      {/* Subscription inactive banner */}
      {!subscriptionActive && !isExpired && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Zap className="w-4 h-4 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Subscription inactive</p>
            <p className="text-xs text-muted-foreground">Sending is locked. Contact support to activate your plan.</p>
          </div>
        </div>
      )}

      {/* Low credit warning (active but ≤ 10 remaining) */}
      {subscriptionActive && creditsRemaining <= 10 && creditsRemaining > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Low credits — {creditsRemaining} remaining</p>
            <p className="text-xs text-muted-foreground">Contact support to top up before you run out.</p>
          </div>
        </div>
      )}

      {/* Zero credits banner */}
      {subscriptionActive && creditsRemaining === 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <Zap className="w-4 h-4 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">No credits remaining</p>
            <p className="text-xs text-muted-foreground">Sending is locked. Your credits reset on {resetLabel ?? "your next billing date"}.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">Outstanding</p>
          </div>
          <p className="text-sm sm:text-base lg:text-xl font-bold leading-tight">R{totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">Overdue</p>
          </div>
          <p className="text-sm sm:text-base lg:text-xl font-bold text-destructive leading-tight">R{overdueTotal.toLocaleString()}</p>
          {overdue.length > 0 && <p className="text-[10px] text-destructive">{overdue.length} req</p>}
        </div>
        <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">Collected</p>
          </div>
          <p className="text-sm sm:text-base lg:text-xl font-bold text-emerald-600 leading-tight">R{paidTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Credits card */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${
              !subscriptionActive ? "text-muted-foreground" :
              creditsRemaining <= 10 ? "text-destructive" :
              creditsRemaining <= 30 ? "text-amber-500" : "text-emerald-500"
            }`} />
            <p className="text-sm font-semibold">Credits this month</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-lg font-bold ${
                isExpired ? "text-destructive" :
                !subscriptionActive ? "text-muted-foreground" :
                creditsRemaining <= 10 ? "text-destructive" :
                creditsRemaining <= 30 ? "text-amber-500" : "text-foreground"
              }`}>{isExpired ? 0 : creditsRemaining}</span>
              <span className="text-xs text-muted-foreground"> / {creditsMonthly} remaining</span>
            </div>
            {!isExpired && <RequestRefillModal creditsRemaining={creditsRemaining} creditsMonthly={creditsMonthly} />}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all ${
              !subscriptionActive ? "bg-muted-foreground/40" :
              creditsRemaining <= 10 ? "bg-destructive" :
              creditsRemaining <= 30 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${creditsPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{isExpired ? 0 : creditsUsed} used</span>
          {resetLabel && subscriptionActive && !isExpired && <span>Expires {resetLabel}</span>}
          {isExpired && <span className="text-destructive font-medium">Subscription expired</span>}
          {!subscriptionActive && !isExpired && <span className="text-destructive font-medium">Subscription inactive</span>}
        </div>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Overdue ({overdue.length})
          </h3>
          <div className="space-y-2">
            {overdue.slice(0, 5).map((r) => {
              const client = r.clients as unknown as { name: string } | null;
              const daysLate = Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000);
              return (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{client?.name ?? "Unknown"}</p>
                    <p className="text-xs text-destructive">{daysLate} days late</p>
                  </div>
                  <span className="text-sm font-semibold text-destructive">R{Number(r.outstanding).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent requests */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Requests</h3>
          <Link href="/dashboard/payments" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {recentRequests.length > 0 ? (
          <div className="divide-y divide-border">
            {recentRequests.map((r) => {
              const client = r.clients as unknown as { name: string } | null;
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{client?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">Due {new Date(r.due_date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[10px] ${statusColor[r.status] ?? ""}`}>{r.status}</Badge>
                    <span className="text-sm font-semibold w-24 text-right">R{Number(r.total_due).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Send className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No requests yet</p>
            <Link href="/dashboard/payments/send">
              <Button size="sm" variant="outline" className="mt-3">Send your first request</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
