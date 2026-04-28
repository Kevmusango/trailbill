"use client";

import { Printer } from "lucide-react";
import { usePrintReport } from "./printable-report";

export function PrintButton() {
  const { handlePrint } = usePrintReport();
  return (
    <button
      onClick={() => handlePrint()}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
    >
      <Printer className="w-4 h-4" />
      Download PDF
    </button>
  );
}
