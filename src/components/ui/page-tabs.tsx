"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type PageTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export type PageTabLinkItem = {
  label: string;
  href: string;
  exact?: boolean;
  count?: number;
};

const tabBarClass = "flex gap-1 overflow-x-auto border-b border-slate-200 px-4 lg:px-6";

function tabItemClass(active: boolean) {
  return cn(
    "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors",
    active
      ? "border-slate-900 font-medium text-slate-900"
      : "border-transparent text-slate-600 hover:text-slate-900",
  );
}

function isLinkActive(
  item: PageTabLinkItem,
  pathname: string,
  searchParams: URLSearchParams,
  allItems: PageTabLinkItem[],
) {
  const itemUrl = new URL(item.href, "http://local");
  const pathOk = item.exact
    ? pathname === itemUrl.pathname
    : pathname === itemUrl.pathname || pathname.startsWith(`${itemUrl.pathname}/`);
  if (!pathOk) return false;

  if (itemUrl.search) {
    for (const [key, value] of itemUrl.searchParams) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  for (const other of allItems) {
    if (other.href === item.href) continue;
    const otherUrl = new URL(other.href, "http://local");
    if (!otherUrl.search) continue;
    let matches = true;
    for (const [key, value] of otherUrl.searchParams) {
      if (searchParams.get(key) !== value) {
        matches = false;
        break;
      }
    }
    if (matches) return false;
  }

  return true;
}

export function PageTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: PageTab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <nav className={cn(tabBarClass, className)} aria-label="Sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? "page" : undefined}
          className={tabItemClass(active === tab.id)}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="ml-1.5 tabular-nums text-xs font-normal text-slate-400">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

export function PageTabLinks({
  items,
  className,
}: {
  items: PageTabLinkItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className={cn(tabBarClass, className)} aria-label="Sections">
      {items.map((item) => {
        const active = isLinkActive(item, pathname, searchParams, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={tabItemClass(active)}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1.5 tabular-nums text-xs font-normal text-slate-400">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
