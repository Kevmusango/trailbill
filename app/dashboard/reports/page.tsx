import { createClient } from "@/lib/supabase/server";
import { Clock, Mail, Settings, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ReportHistoryList } from "@/components/dashboard/report-history-list";
import { SendReportNowButton } from "@/components/dashboard/send-report-now-button";

export default async function ReportsHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, email, daily_digest_enabled, daily_digest_time")
    .eq("owner_id", user?.id ?? "")
    .single();

  const businessId = business?.id ?? "";
  const digestEnabled = business?.daily_digest_enabled ?? false;
  const digestTime = business?.daily_digest_time?.slice(0, 5) ?? "08:00";

  const { data: rawHistory } = businessId
    ? await supabase
        .from("report_log")
        .select("id, report_type, period_label, period_start, sent_at, generated_at, email_sent_to")
        .eq("business_id", businessId)
        .eq("report_type", "daily")
        .order("generated_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const history = rawHistory ?? [];

  return (
    <div className="p-4 lg:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Morning Update</h2>
          <p className="text-sm text-muted-foreground">A daily email with everything happening with your payments</p>
        </div>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Configure
        </Link>
      </div>

      {/* Email address notice */}
      {business?.email ? (
        <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-6 text-sm">
          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Sent to <strong>{business.email}</strong></span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
          <Mail className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800 dark:text-amber-200">
            No email address set —{" "}
            <Link href="/dashboard/settings" className="underline font-medium">add one in Settings</Link>{" "}
            to start receiving updates.
          </span>
        </div>
      )}

      {/* Daily Digest card */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Daily Digest</p>
              <p className="text-xs text-muted-foreground">
                {digestEnabled ? `Sent every morning at ${digestTime}` : "Not active yet"}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
            digestEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {digestEnabled ? "Active" : "Off"}
          </span>
        </div>

        {/* What's included */}
        <div className="space-y-2 mb-5">
          {[
            "Who is paying today (committed dates)",
            "Who was reminded yesterday and via which channel",
            "Who opened their payment link but hasn't committed",
            "Who paid yesterday",
            "Who is overdue and by how many days",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              {line}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/reports/daily"
            className="text-sm font-medium text-primary hover:underline"
          >
            Preview today's report →
          </Link>
          <SendReportNowButton type="daily" />
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Recently sent
          </h3>
          <ReportHistoryList history={history as any} />
        </div>
      )}

    </div>
  );
}

