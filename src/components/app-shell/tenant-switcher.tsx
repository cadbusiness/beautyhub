"use client";

import { selectTenant } from "@/lib/tenant/actions";
import type { TenantOption } from "@/lib/tenant/defaults";

export function TenantSwitcher({
  tenants,
  currentSlug,
}: {
  tenants: TenantOption[];
  currentSlug: string;
}) {
  if (tenants.length === 0) return null;

  if (tenants.length === 1) {
    return (
      <p className="truncate text-sm font-semibold text-slate-900">{tenants[0].name}</p>
    );
  }

  return (
    <form action={selectTenant}>
      <label className="sr-only" htmlFor="tenant-switcher">
        Institut
      </label>
      <select
        id="tenant-switcher"
        name="slug"
        defaultValue={currentSlug}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
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
