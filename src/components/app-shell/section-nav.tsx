"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  label: string;
  href: string;
  /** Active uniquement sur l'URL exacte (ex: vue d'ensemble). */
  exact?: boolean;
}

export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const pathname = usePathname();

  function isActive(item: SectionNavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          className={cn(
            "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors",
            isActive(item)
              ? "border-violet-600 font-medium text-violet-700"
              : "border-transparent text-slate-600 hover:text-slate-900",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
