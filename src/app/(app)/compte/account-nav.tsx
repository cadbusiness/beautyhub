"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type AccountNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations("account.nav");

  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto lg:w-44 lg:flex-col lg:overflow-visible"
      aria-label={t("ariaLabel")}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-slate-100 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
