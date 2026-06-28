import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { AppLogo } from "@/components/app-shell/app-logo";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { TenantSwitcher } from "@/components/app-shell/tenant-switcher";
import type { TenantOption } from "@/lib/tenant/defaults";

export async function AppHeader({
  email,
  role,
  platformAdmin,
  tenants,
  currentSlug,
}: {
  email: string | null;
  role: string;
  platformAdmin: boolean;
  tenants: TenantOption[];
  currentSlug: string;
}) {
  const t = await getTranslations("shell");
  const tRoles = await getTranslations("roles");
  const knownRoles = [
    "platform_admin",
    "brand_owner",
    "tenant_owner",
    "staff",
    "coach",
  ] as const;
  const roleText = knownRoles.includes(role as (typeof knownRoles)[number])
    ? tRoles(role as (typeof knownRoles)[number])
    : role;
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
      <AppLogo />

      <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />

      <TenantSwitcher
        tenants={tenants}
        currentSlug={currentSlug}
        className="min-w-0"
      />

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {platformAdmin ? (
          <Link
            href="/admin"
            prefetch
            className="hidden text-sm text-slate-600 hover:text-slate-900 sm:inline"
          >
            {t("administration")}
          </Link>
        ) : null}

        <LocaleSwitcher className="hidden sm:block" />

        <div className="hidden text-right sm:block">
          <p className="truncate text-sm text-slate-900">{email}</p>
          <p className="text-xs text-slate-500">{roleText}</p>
        </div>

        <form action={signOut}>
          <Button variant="outline" type="submit" className="h-9 px-3 text-sm">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </header>
  );
}
