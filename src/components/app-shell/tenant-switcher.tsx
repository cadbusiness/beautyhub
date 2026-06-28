"use client";

import { selectTenant } from "@/lib/tenant/actions";
import type { TenantOption } from "@/lib/tenant/defaults";
import { cn } from "@/lib/utils";

export function TenantSwitcher({
  tenants,
  currentSlug,
  className,
}: {
  tenants: TenantOption[];
  currentSlug: string;
  className?: string;
}) {
  if (tenants.length === 0) return null;

  if (tenants.length === 1) {
    return (
      <span className={cn("text-sm text-slate-600", className)}>
        {tenants[0].name}
      </span>
    );
  }

  return (
    <form action={selectTenant} className={className}>
      <label className="sr-only" htmlFor="tenant-switcher">
        Institut
      </label>
      <select
        id="tenant-switcher"
        name="slug"
        defaultValue={currentSlug}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {tenants.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    </form>
  );
}
