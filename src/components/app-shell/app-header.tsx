import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { roleLabel } from "@/lib/auth/role-labels";
import { AppLogo } from "@/components/app-shell/app-logo";
import { TenantSwitcher } from "@/components/app-shell/tenant-switcher";
import type { TenantOption } from "@/lib/tenant/defaults";

export function AppHeader({
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
            Administration
          </Link>
        ) : null}

        <div className="hidden text-right sm:block">
          <p className="truncate text-sm text-slate-900">{email}</p>
          <p className="text-xs text-slate-500">{roleLabel(role)}</p>
        </div>

        <form action={signOut}>
          <Button variant="outline" type="submit" className="h-9 px-3 text-sm">
            Déconnexion
          </Button>
        </form>
      </div>
    </header>
  );
}
