"use client";

import { cn } from "@/lib/utils";

export type PageTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

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
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-slate-200 px-4 lg:px-6",
        className,
      )}
      aria-label="Sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors",
            active === tab.id
              ? "border-slate-900 font-medium text-slate-900"
              : "border-transparent text-slate-600 hover:text-slate-900",
          )}
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
