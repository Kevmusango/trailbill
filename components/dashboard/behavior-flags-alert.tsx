"use client";

import { useState } from "react";
import { X, AlertTriangle, AlertCircle, TrendingUp, ShieldCheck, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BehaviorFlag {
  id: string;
  client_id: string;
  client_name: string;
  flag_type: string;
  message: string;
  severity: "critical" | "warning" | "info";
  created_at: string;
}

interface BehaviorFlagsAlertProps {
  flags: BehaviorFlag[];
}

const FLAG_ICON = {
  critical: AlertCircle,
  warning:  AlertTriangle,
  info:     TrendingUp,
};

const FLAG_STYLES = {
  critical: {
    bar:    "border-destructive/40 bg-destructive/5",
    icon:   "text-destructive",
    badge:  "bg-destructive/10 text-destructive border border-destructive/20",
    dot:    "bg-destructive",
  },
  warning: {
    bar:    "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800",
    icon:   "text-amber-600",
    badge:  "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    dot:    "bg-amber-500",
  },
  info: {
    bar:    "border-primary/30 bg-primary/5",
    icon:   "text-primary",
    badge:  "bg-primary/10 text-primary border border-primary/20",
    dot:    "bg-primary",
  },
};

const FLAG_TYPE_LABEL: Record<string, string> = {
  first_miss:      "First Miss",
  needs_attention: "Needs Attention",
  watch:           "Watch",
  reliable:        "Reliable",
  improving:       "Improving",
};

export function BehaviorFlagsAlert({ flags: initialFlags }: BehaviorFlagsAlertProps) {
  const [flags, setFlags] = useState(initialFlags);
  const router = useRouter();

  if (flags.length === 0) return null;

  const dismiss = async (flagId: string) => {
    setFlags(prev => prev.filter(f => f.id !== flagId));
    const supabase = createClient();
    await supabase.from("behavior_flags").update({ is_read: true }).eq("id", flagId);
    router.refresh();
  };

  const dismissAll = async () => {
    const ids = flags.map(f => f.id);
    setFlags([]);
    const supabase = createClient();
    await supabase.from("behavior_flags").update({ is_read: true }).in("id", ids);
    router.refresh();
  };

  return (
    <div className="mb-3 space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          Client Alerts ({flags.length})
        </p>
        {flags.length > 1 && (
          <button
            onClick={dismissAll}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Flag rows */}
      {flags.map((flag) => {
        const styles = FLAG_STYLES[flag.severity];
        const Icon = FLAG_ICON[flag.severity];
        return (
          <div
            key={flag.id}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${styles.bar}`}
          >
            <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${styles.icon}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href="/dashboard/clients"
                  className="text-xs font-semibold hover:underline truncate"
                >
                  {flag.client_name}
                </Link>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                  {FLAG_TYPE_LABEL[flag.flag_type] ?? flag.flag_type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{flag.message}</p>
            </div>
            <button
              onClick={() => dismiss(flag.id)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors mt-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
