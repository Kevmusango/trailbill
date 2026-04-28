"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleReportListProps {
  children: React.ReactNode[];
  initialCount?: number;
  totalLabel: string;
}

export function CollapsibleReportList({
  children,
  initialCount = 8,
  totalLabel,
}: CollapsibleReportListProps) {
  const [expanded, setExpanded] = useState(false);
  const total = children.length;
  const visible = expanded ? children : children.slice(0, initialCount);
  const hidden = total - initialCount;

  return (
    <div className="bg-card rounded-xl border border-border divide-y divide-border">
      {visible}
      {hidden > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center gap-1.5 w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Show {hidden} more {totalLabel}
        </button>
      )}
      {expanded && total > initialCount && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center justify-center gap-1.5 w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          Show less
        </button>
      )}
    </div>
  );
}
