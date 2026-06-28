"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/app-shell/nav-link";
import { NavIconPanelLeft, NavItemIcon } from "@/components/app-shell/nav-icons";
import type { NavGroup } from "@/modules/registry";

const SIDEBAR_COLLAPSED_KEY = "beautyhub-sidebar-collapsed";
const SECTION_COLLAPSED_PREFIX = "beautyhub-nav-section-";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function sectionMeta(moduleId: string): {
  titleKey: "institut" | "academie" | null;
  icon?: string;
} {
  if (moduleId === "institut") return { titleKey: "institut", icon: "sparkles" };
  if (moduleId === "academie") return { titleKey: "academie", icon: "graduation-cap" };
  return { titleKey: null };
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
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    const sections: Record<string, boolean> = {};
    for (const group of navGroups) {
      sections[group.moduleId] =
        localStorage.getItem(`${SECTION_COLLAPSED_PREFIX}${group.moduleId}`) === "1";
    }
    setSectionCollapsed(sections);
    setHydrated(true);
  }, [navGroups]);

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

  function toggleSection(moduleId: string) {
    setSectionCollapsed((prev) => {
      const next = !prev[moduleId];
      localStorage.setItem(
        `${SECTION_COLLAPSED_PREFIX}${moduleId}`,
        next ? "1" : "0",
      );
      return { ...prev, [moduleId]: next };
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
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3"
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
            <div className="my-1 border-t border-slate-100" aria-hidden />
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
              const { titleKey, icon } = sectionMeta(group.moduleId);
              const sectionTitle = titleKey
                ? t(titleKey)
                : group.moduleName;
              const isSectionCollapsed = sectionCollapsed[group.moduleId] ?? false;

              return (
                <div
                  key={group.moduleId}
                  className={cn(groupIndex > 0 && "mt-3 border-t border-slate-100 pt-3")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(group.moduleId)}
                    className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                    aria-expanded={!isSectionCollapsed}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {icon ? (
                        <NavItemIcon name={icon} className="text-slate-400" />
                      ) : null}
                      <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {sectionTitle}
                      </span>
                    </span>
                    <ChevronIcon open={!isSectionCollapsed} />
                  </button>

                  {!isSectionCollapsed ? (
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
                  ) : null}
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
