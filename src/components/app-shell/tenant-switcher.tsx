"use client";

import Link from "next/link";
import { selectTenant } from "@/lib/tenant/actions";
import type { TenantOption } from "@/lib/tenant/defaults";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Super admin",
  brand_owner: "Propriétaire marque",
  tenant_owner: "Propriétaire",
  staff: "Staff",
  coach: "Coach",
};

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
        className="h-9 max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
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

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export function AppLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
        B
      </span>
      <span className="hidden text-base font-semibold text-slate-900 sm:inline">
        BeautyHub
      </span>
    </Link>
  );
}
