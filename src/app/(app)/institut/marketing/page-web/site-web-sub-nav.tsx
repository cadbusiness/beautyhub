"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/institut/marketing/page-web", exact: true, labelKey: "tabs.pages" as const },
  { href: "/institut/marketing/page-web/theme", labelKey: "tabs.branding" as const },
];

export function SiteWebSubNav() {
  const t = useTranslations("institut.marketing.website");
  const pathname = usePathname();

  return (
    <nav
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      aria-label={t("tabs.pages")}
    >
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-white font-medium text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
