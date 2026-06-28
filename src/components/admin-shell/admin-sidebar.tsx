"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/app-shell/nav-link";
import { NavIconPanelLeft } from "@/components/app-shell/nav-icons";
import { ADMIN_NAV_ITEMS } from "@/lib/admin/nav";

const SIDEBAR_COLLAPSED_KEY = "beautyhub-admin-sidebar-collapsed";

export function AdminSidebar({ openTicketCount = 0 }: { openTicketCount?: number }) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    setHydrated(true);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  const collapsed = hydrated && sidebarCollapsed;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-52 lg:w-56",
      )}
    >
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3"
        aria-label={tShell("sidebar.ariaLabel")}
      >
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={t(item.labelKey)}
            exact={item.exact}
            icon={item.icon}
            collapsed={collapsed}
            badge={
              item.badgeKey === "openTickets" && openTicketCount > 0
                ? openTicketCount
                : undefined
            }
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700",
            collapsed ? "justify-center" : "gap-2.5",
          )}
          title={collapsed ? tShell("sidebar.expand") : tShell("sidebar.collapse")}
          aria-label={collapsed ? tShell("sidebar.expand") : tShell("sidebar.collapse")}
        >
          <NavIconPanelLeft
            className={cn("transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed ? (
            <span className="truncate text-xs">{tShell("sidebar.collapse")}</span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
