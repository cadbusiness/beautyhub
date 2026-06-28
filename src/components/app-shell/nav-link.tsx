"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  exact = false,
  indicator,
}: {
  href: string;
  label: string;
  exact?: boolean;
  indicator?: "dot-green";
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
      className={cn(
        "block rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-slate-100 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {indicator === "dot-green" ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-green-500 ring-2 ring-green-100"
            title={tPos("navIndicator")}
            aria-hidden
          />
        ) : null}
      </span>
    </Link>
  );
}
