"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  CalendarDays,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard",          icon: LayoutDashboard },
  { label: "Calendar",   href: "/dashboard/calendar",   icon: CalendarDays },
  { label: "Clients",   href: "/dashboard/clients",  icon: Users },
  { label: "Groups",    href: "/dashboard/groups",   icon: FolderOpen },
  { label: "Payments",   href: "/dashboard/payments",   icon: CreditCard },
  { label: "Proposals",  href: "/dashboard/proposals",  icon: FileText },
];

interface DashboardSidebarProps {
  businessName?: string;
}

export function DashboardSidebar({
  businessName,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const mobileSidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-sidebar-border bg-background">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" alt="" className="h-7 w-auto object-contain flex-shrink-0" />
          {businessName && (
            <span className="text-xs text-muted-foreground truncate block">{businessName}</span>
          )}
        </Link>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all",
                active ? "bg-primary/20 text-primary" : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-background border border-border shadow-sm lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        {mobileSidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-200 ease-in-out relative",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Floating collapse toggle at right edge */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[68px] z-10 w-6 h-6 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
        {/* Logo */}
        <div className={cn("border-b border-sidebar-border bg-background flex items-center h-14", collapsed ? "justify-center px-0" : "px-4")}>
          <Link href="/dashboard" className="flex items-center min-w-0">
            <img src="/logo.png" alt="" className={collapsed ? "h-6 w-auto object-contain" : "h-7 w-auto object-contain flex-shrink-0"} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-lg text-sm transition-all py-3",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                  active
                    ? "bg-primary/20 text-primary font-semibold"
                    : "font-medium text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
