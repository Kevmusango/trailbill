"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminHeaderProps {
  userInitial?: string;
}

export function AdminHeader({ userInitial = "A" }: AdminHeaderProps) {
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

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-sidebar-border bg-sidebar flex items-center gap-3 px-4 lg:px-6 flex-shrink-0">
      {/* Mobile hamburger spacer */}
      <div className="w-10 lg:hidden flex-shrink-0" />

      {/* Admin badge */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sidebar-accent text-xs font-semibold text-primary">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Admin Panel</span>
      </div>

      {/* Push everything to the right */}
      <div className="flex-1" />

      {/* Date/time */}
      {dateStr && (
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-[10px] text-slate-400">{dateStr} · {timeStr}</span>
        </div>
      )}

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
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-background shadow-lg py-1.5 z-50">
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
