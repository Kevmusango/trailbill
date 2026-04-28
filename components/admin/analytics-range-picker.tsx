"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { label: "6m",   value: "6" },
  { label: "12m",  value: "12" },
  { label: "24m",  value: "24" },
  { label: "All",  value: "all" },
];

export function AnalyticsRangePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "12";

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => router.push(`/admin/analytics?range=${o.value}`)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
            current === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
