"use client";

import { useEffect, useState } from "react";
import { Bell, Send, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface TodaySummary {
  totalReminders: number;
  pendingReminders: number;
  scheduledSends: number;
}

export function TodaysActivityCard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaysSummary();
  }, []);

  const fetchTodaysSummary = async () => {
    try {
      const res = await fetch("/api/activity/today");
      const data = await res.json();

      if (data.success) {
        setSummary(data.summary);

        if (data.summary.pendingReminders > 0) {
          setNextAction(`${data.summary.pendingReminders} follow-up${data.summary.pendingReminders > 1 ? "s" : ""} pending`);
        } else if (data.summary.scheduledSends > 0) {
          setNextAction(`${data.summary.scheduledSends} payment request${data.summary.scheduledSends > 1 ? "s" : ""} scheduled`);
        } else if (data.weeklyReports.weekly) {
          const nextDate = new Date(data.weeklyReports.weekly.nextSend);
          const dayName = nextDate.toLocaleDateString("en-ZA", { weekday: "long" });
          setNextAction(`Next: ${dayName} Weekly Report`);
        } else {
          setNextAction("All caught up!");
        }
      }
    } catch (error) {
      toast.error("Failed to load today's activity");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-20 bg-muted/30 rounded" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <Link href="/dashboard/activity" className="block">
      <div className="bg-gradient-to-br from-sky-50 to-purple-50 border border-sky-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              Today's Activity
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("en-ZA", { 
                timeZone: "Africa/Johannesburg",
                weekday: "short", 
                month: "short", 
                day: "numeric" 
              })}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 mx-auto mb-1">
              <Bell className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-lg font-bold">{summary.totalReminders}</p>
            <p className="text-[10px] text-muted-foreground">Follow Ups</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 mx-auto mb-1">
              <Send className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-lg font-bold">{summary.scheduledSends}</p>
            <p className="text-[10px] text-muted-foreground">Scheduled</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 mx-auto mb-1">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-lg font-bold">{summary.pendingReminders}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
        </div>

        {nextAction && (
          <div className="bg-white/60 rounded-lg px-3 py-2 text-center">
            <p className="text-xs font-medium text-sky-700">{nextAction}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
