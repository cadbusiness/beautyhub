"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export function SectionNav({
  items,
  ariaLabel,
}: {
  items: SectionNavItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible"
      aria-label={ariaLabel}
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
              "shrink-0 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full",
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
