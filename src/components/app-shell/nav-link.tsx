"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NavItemIcon } from "@/components/app-shell/nav-icons";

export function NavLink({
  href,
  label,
  exact = false,
  indicator,
  icon,
  collapsed = false,
}: {
  href: string;
  label: string;
  exact?: boolean;
  indicator?: "dot-green";
  icon?: string;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const tPos = useTranslations("shell.posSession");
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-slate-100 font-medium text-slate-900 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      {icon ? (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          <NavItemIcon
            name={icon}
            className={cn(
              "transition-colors",
              active
                ? "text-slate-700"
                : "text-slate-400 group-hover:text-slate-600",
            )}
          />
        </span>
      ) : null}
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {indicator === "dot-green" ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-green-500 ring-2 ring-green-100"
              title={tPos("navIndicator")}
              aria-hidden
            />
          ) : null}
        </span>
      ) : indicator === "dot-green" ? (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-100"
          title={tPos("navIndicator")}
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
