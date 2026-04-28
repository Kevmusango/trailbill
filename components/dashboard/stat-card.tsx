import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon: Icon, iconColor = "text-primary", trend }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight truncate">{value}</h3>
          {trend && (
            <p className={cn("text-xs mt-1 font-medium", trend.isPositive ? "text-emerald-600" : "text-destructive")}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
