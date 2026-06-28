"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/app-shell/nav-link";
import { NavIconPanelLeft } from "@/components/app-shell/nav-icons";
import type { NavGroup } from "@/modules/registry";

const SIDEBAR_COLLAPSED_KEY = "beautyhub-sidebar-collapsed";

function sectionTitleKey(moduleId: string): "institut" | "academie" | null {
  if (moduleId === "institut") return "institut";
  if (moduleId === "academie") return "academie";
  return null;
}

export function AppSidebar({
  homeLabel,
  navGroups,
  posOpenHref,
}: {
  homeLabel: string;
  navGroups: NavGroup[];
  posOpenHref?: string;
}) {
  const t = useTranslations("shell");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    setHydrated(true);
  }, []);

  const flatItems = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups],
  );

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  const collapsed = hydrated && sidebarCollapsed;
  const showSectionTitles = navGroups.length > 1;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-52 lg:w-56",
      )}
    >
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3"
        aria-label={t("sidebar.ariaLabel")}
      >
        <NavLink
          href="/dashboard"
          label={homeLabel}
          exact
          icon="home"
          collapsed={collapsed}
        />

        {collapsed ? (
          <>
            <div className="my-1.5 border-t border-slate-100" aria-hidden />
            {flatItems.map((item) => (
              <NavLink
                key={`${item.moduleId}-${item.href}`}
                href={item.href}
                label={item.label}
                exact={item.exact}
                icon={item.icon}
                collapsed
                indicator={
                  posOpenHref === item.href ? "dot-green" : undefined
                }
              />
            ))}
          </>
        ) : (
          <>
            <div className="my-2 border-t border-slate-100" aria-hidden />
            {navGroups.map((group, groupIndex) => {
              const titleKey = sectionTitleKey(group.moduleId);
              const sectionTitle = titleKey
                ? t(titleKey)
                : group.moduleName;

              return (
                <div
                  key={group.moduleId}
                  className={cn(groupIndex > 0 && "mt-3")}
                >
                  {showSectionTitles ? (
                    <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {sectionTitle}
                    </p>
                  ) : null}
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={`${item.moduleId}-${item.href}`}
                        href={item.href}
                        label={item.label}
                        exact={item.exact}
                        icon={item.icon}
                        indicator={
                          posOpenHref === item.href ? "dot-green" : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700",
            collapsed ? "justify-center" : "gap-2.5",
          )}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          <NavIconPanelLeft
            className={cn(
              "transition-transform",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed ? (
            <span className="truncate text-xs">
              {t("sidebar.collapse")}
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
