"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, CalendarClock, Settings, LogOut, ChevronDown } from "lucide-react";
import { RequestRefillModal } from "@/components/dashboard/request-refill-modal";
import { getSubscriptionStatus } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/client";

interface DashboardHeaderProps {
  businessName?: string;
  creditsRemaining?: number;
  creditsMonthly?: number;
  subscriptionActive?: boolean;
  subscriptionStart?: string | null;
  subscriptionDays?: number;
  userInitial?: string;
}

export function DashboardHeader({
  businessName,
  creditsRemaining = 0,
  creditsMonthly = 100,
  subscriptionActive = false,
  subscriptionStart = null,
  subscriptionDays = 30,
  userInitial = "U",
}: DashboardHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const dateStr = now
    ? now.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
    : "";

  const sub = getSubscriptionStatus(subscriptionStart, subscriptionDays);
  const daysLeft = sub.daysLeft;
  const isExpired = !subscriptionActive && sub.hasSubscription;
  const daysLeftLabel =
    !sub.hasSubscription
      ? null
      : isExpired
      ? "Subscription expired"
      : !subscriptionActive
      ? null
      : daysLeft <= 0
      ? "Subscription expired"
      : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`;
  const daysLeftColor =
    daysLeft <= 3 ? "text-red-400" : daysLeft <= 7 ? "text-amber-400" : "text-emerald-400";

  const displayedCredits = isExpired ? 0 : creditsRemaining;
  const creditColor =
    isExpired
      ? "text-red-400"
      : !subscriptionActive
      ? "text-slate-500"
      : creditsRemaining <= 10
      ? "text-red-400"
      : creditsRemaining <= 30
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-sidebar-border bg-sidebar flex items-center gap-3 px-4 lg:px-6 flex-shrink-0">
      {/* Mobile hamburger spacer */}
      <div className="w-10 lg:hidden flex-shrink-0" />

      {/* Push everything to the right */}
      <div className="flex-1" />

      {/* Credits pill */}
      <div
        className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sidebar-accent text-xs font-semibold ${creditColor}`}
      >
        <Zap className="w-3.5 h-3.5" />
        <span>
          {isExpired
            ? `${displayedCredits} / ${creditsMonthly}`
            : subscriptionActive
            ? `${displayedCredits} / ${creditsMonthly}`
            : "No plan"}
        </span>
      </div>

      {/* Buy Now button */}
      {subscriptionActive && !isExpired && (
        <RequestRefillModal variant="button" creditsRemaining={creditsRemaining} creditsMonthly={creditsMonthly} />
      )}

      {/* Days left pill */}
      {daysLeftLabel && (
        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sidebar-accent text-xs font-semibold ${daysLeftColor}`}>
          <CalendarClock className="w-3.5 h-3.5" />
          <span>{daysLeftLabel}</span>
        </div>
      )}

      {/* Divider */}
      <div className="hidden md:block h-5 w-px bg-sidebar-border flex-shrink-0" />

      {/* Business name + date/time */}
      <div className="hidden md:flex flex-col items-end leading-tight">
        <span className="text-xs font-semibold text-white truncate max-w-[160px]">
          {businessName ?? "TrailBill"}
        </span>
        {dateStr && (
          <span className="text-[10px] text-slate-400">
            {dateStr} · {timeStr}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="hidden md:block h-5 w-px bg-sidebar-border flex-shrink-0" />

      {/* Avatar + dropdown */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-full focus:outline-none"
          aria-label="Account menu"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold select-none ring-2 ring-primary/20">
            {userInitial}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-background shadow-lg py-1.5 z-50">
            <Link
              href="/dashboard/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              Settings
            </Link>
            <div className="my-1.5 border-t border-border" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
