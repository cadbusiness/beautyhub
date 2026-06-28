import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAccessibleTenants,
  getCurrentUser,
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { ensureDefaultTenant } from "@/lib/tenant/ensure";
import { getNavFor } from "@/modules";
import { NavLink } from "@/components/app-shell/nav-link";
import { TenantSwitcher } from "@/components/app-shell/tenant-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureDefaultTenant();

  const tenant = await getTenantContext();
  if (!tenant) redirect("/login");

  const platformAdmin = await isPlatformAdmin();
  const role = platformAdmin
    ? "platform_admin"
    : await getRoleForTenant(tenant.id);
  if (!role) redirect("/login");

  const enabledModuleIds = await getEnabledModuleIds(tenant.id);
  const nav = getNavFor(enabledModuleIds, role);
  const accessibleTenants = await getAccessibleTenants();

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <div className="space-y-1 border-b border-slate-100 pb-4">
          <TenantSwitcher
            tenants={accessibleTenants.map((t) => ({
              slug: t.slug,
              name: t.name,
              role: t.role,
            }))}
            currentSlug={tenant.slug}
          />
          <p className="truncate px-0.5 text-xs text-slate-500">{role}</p>
        </div>

        <nav className="flex-1 space-y-0.5 py-4">
          <NavLink href="/dashboard" label="Accueil" />
          <NavLink href="/assistant" label="Assistant IA" />
          {nav.map((item) => (
            <NavLink
              key={`${item.moduleId}-${item.href}`}
              href={item.href}
              label={item.label}
            />
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          {platformAdmin ? (
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Administration
            </Link>
          ) : null}
          <p className="truncate px-2 text-xs text-slate-400">{user.email}</p>
          <form action={signOut}>
            <Button variant="outline" type="submit" className="w-full">
              Deconnexion
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
