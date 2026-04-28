"use client";

import { useState } from "react";
import { FileText, ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";

interface HistoryEntry {
  id: string;
  report_type: string;
  period_label: string;
  period_start: string | null;
  sent_at: string | null;
  generated_at: string;
  email_sent_to: string | null;
}

function viewHref(reportType: string, periodStart: string | null): string | null {
  if (!periodStart) return null;
  if (reportType === "daily_digest") return `/dashboard/reports/daily?date=${periodStart}`;
  if (reportType === "weekly_report" || reportType === "end_of_week") return `/dashboard/reports/weekly?week=${periodStart}`;
  if (reportType === "monthly" || reportType === "month_end" || reportType === "month_start") return `/dashboard/reports/monthly?month=${periodStart.slice(0, 7)}`;
  return null;
}

interface ReportHistoryListProps {
  history: HistoryEntry[];
}

const TYPE_LABELS: Record<string, string> = {
  daily_digest:  "Daily",
  weekly_report: "Weekly",
  end_of_week:   "End of Week",
  month_start:   "Month Start",
  month_end:     "Monthly",
  monthly:       "Monthly",
};

const FILTERS = [
  { key: "all",          label: "All" },
  { key: "daily_digest", label: "Daily" },
  { key: "weekly",       label: "Weekly" },
  { key: "monthly",      label: "Monthly" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

const PAGE = 10;

export function ReportHistoryList({ history }: ReportHistoryListProps) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);

  const filtered = history.filter(h => {
    if (filter === "all") return true;
    if (filter === "monthly") return h.report_type === "month_end" || h.report_type === "monthly";
    if (filter === "weekly")  return h.report_type === "weekly_report" || h.report_type === "end_of_week";
    return h.report_type === filter;
  });

  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > shown;

  if (history.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border px-4 py-10 text-center">
        <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No reports sent yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Reports will appear here once they are generated and emailed
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setShown(PAGE); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1 opacity-60">
                ({history.filter(h =>
                  f.key === "monthly" ? (h.report_type === "month_end" || h.report_type === "monthly") :
                  f.key === "weekly"  ? (h.report_type === "weekly_report" || h.report_type === "end_of_week") :
                  h.report_type === f.key
                ).length})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {filtered.length} report{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter.replace(/_/g, " ")} reports yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {visible.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                    {TYPE_LABELS[h.report_type] ?? h.report_type.replace(/_/g, " ")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{h.period_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.email_sent_to ? `Emailed to ${h.email_sent_to}` : "Preview only"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(h.sent_at ?? h.generated_at)}
                  </span>
                  {viewHref(h.report_type, h.period_start) && (
                    <Link
                      href={viewHref(h.report_type, h.period_start)!}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline whitespace-nowrap"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setShown(s => s + PAGE)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Show {Math.min(PAGE, filtered.length - shown)} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
