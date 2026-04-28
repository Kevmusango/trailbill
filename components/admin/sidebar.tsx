"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, UserPlus, BarChart2, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview",   href: "/admin",              icon: LayoutDashboard },
  { label: "Businesses", href: "/admin/businesses",   icon: Building2 },
  { label: "Leads",      href: "/admin/leads",        icon: UserPlus },
  { label: "Analytics",  href: "/admin/analytics",   icon: BarChart2 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const sidebarContent = (isCollapsed: boolean, onClose?: () => void) => (
    <div className="flex flex-col h-full">
      <div className={cn("h-14 border-b border-sidebar-border bg-background flex items-center", isCollapsed ? "justify-center px-2" : "px-4")}>
        {isCollapsed ? (
          <Link href="/admin">
            <img src="/logo.png" alt="" className="h-6 w-auto object-contain" />
          </Link>
        ) : (
          <Link href="/admin" className="flex items-center min-w-0" onClick={onClose}>
            <img src="/logo.png" alt="" className="h-7 w-auto object-contain flex-shrink-0" />
          </Link>
        )}
      </div>

      <nav className={cn("flex-1 py-3 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-2")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center rounded-lg text-sm font-medium transition-all",
                isCollapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3",
                active
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {!onClose && (
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "w-full flex items-center rounded-lg px-2 py-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors",
              isCollapsed ? "justify-center" : "gap-2 text-xs"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-background border border-border shadow-sm lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent(false, () => setMobileOpen(false))}
      </aside>

      <aside
        className={cn(
          "hidden lg:flex flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex-col transition-all duration-200",
          collapsed ? "w-14" : "w-64"
        )}
      >
        {sidebarContent(collapsed)}
      </aside>
    </>
  );
}
