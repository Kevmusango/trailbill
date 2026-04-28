import { Building2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionStatus } from "@/lib/subscription";
import { BusinessActions } from "@/components/admin/business-actions";
import { AddBusinessModal } from "@/components/admin/add-business-modal";

export default async function AdminBusinessesPage() {
  const supabase = await createClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*, profiles:owner_id(email, full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold mb-1">Businesses</h2>
          <p className="text-sm text-muted-foreground">Manage registered businesses and subscriptions</p>
        </div>
        <AddBusinessModal />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search businesses..." className="pl-10" />
          </div>
        </div>

        {businesses && businesses.length > 0 ? (
          <div className="divide-y divide-border">
            {businesses.map((biz) => {
              const owner = biz.profiles as { email: string; full_name: string | null } | null;
              const sub = getSubscriptionStatus(biz.subscription_start, biz.subscription_days);
              const subBadge = !sub.hasSubscription
                ? { label: "No sub",         cls: "bg-muted text-muted-foreground" }
                : !sub.isActive
                ? { label: "Expired",         cls: "bg-destructive/10 text-destructive" }
                : sub.daysLeft <= 7
                ? { label: `${sub.daysLeft}d left`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" }
                : { label: `${sub.daysLeft}d left`, cls: "bg-primary/10 text-primary" };

              return (
                <div key={biz.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <h3 className="text-sm font-semibold truncate max-w-[200px]">{biz.name}</h3>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${subBadge.cls}`}>
                        {subBadge.label}
                      </span>
                      <Badge variant={biz.status === "active" ? "success" : "destructive"} className="text-[10px] flex-shrink-0">
                        {biz.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {owner?.email ?? "No owner"}
                      {" · "}
                      <span className={sub.isExpired ? "text-destructive font-medium" : biz.credits_remaining <= 10 ? "text-destructive font-medium" : ""}>
                        {sub.isExpired ? 0 : (biz.credits_remaining ?? 0)} credits
                      </span>
                    </p>
                  </div>
                  <div className="flex-shrink-0 self-start sm:self-auto">
                    <BusinessActions
                      businessId={biz.id}
                      businessName={biz.name}
                      subscriptionStart={biz.subscription_start}
                      subscriptionDays={biz.subscription_days}
                      creditsRemaining={biz.credits_remaining ?? 0}
                      creditsMonthly={biz.credits_monthly ?? 100}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No businesses yet</h3>
            <p className="text-muted-foreground">Convert leads to add businesses</p>
          </div>
        )}
      </div>
    </div>
  );
}
