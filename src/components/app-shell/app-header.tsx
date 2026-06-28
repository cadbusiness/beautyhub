import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppLogo } from "@/components/app-shell/app-logo";
import { TenantSwitcher } from "@/components/app-shell/tenant-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { TenantOption } from "@/lib/tenant/defaults";

export async function AppHeader({
  email,
  role,
  platformAdmin,
  tenants,
  currentSlug,
  displayName,
  profileInitial,
}: {
  email: string | null;
  role: string;
  platformAdmin: boolean;
  tenants: TenantOption[];
  currentSlug: string;
  displayName: string;
  profileInitial: string;
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
            className="hidden text-sm text-slate-600 hover:text-slate-900 md:inline"
          >
            {t("administration")}
          </Link>
        ) : null}

        <UserMenu
          email={email}
          roleText={roleText}
          displayName={displayName}
          initial={profileInitial}
        />
      </div>
    </header>
  );
}
