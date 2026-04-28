"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface ReportsMonthNavProps {
  year: number;
  month: number; // 1-12
  basePath?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ReportsMonthNav({ year, month, basePath = "/dashboard/reports" }: ReportsMonthNavProps) {
  const router = useRouter();

  const go = (offset: number) => {
    let m = month - 1 + offset; // 0-indexed
    let y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    router.push(`${basePath}?month=${y}-${String(m + 1).padStart(2, "0")}`);
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => go(-1)}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-lg font-bold min-w-[160px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        onClick={() => go(1)}
        disabled={isCurrentMonth()}
        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
