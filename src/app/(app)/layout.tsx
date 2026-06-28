import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppShellData } from "@/lib/auth/team-session";
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

  const shell = await getAppShellData();
  if (!shell) redirect("/login");

  const { session, accessibleTenants } = shell;
  const nav = getNavFor(session.enabledModuleIds, session.role);
  const platformAdmin = session.role === "platform_admin";

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 lg:w-56">
        <div className="space-y-1 border-b border-slate-100 pb-3">
          <TenantSwitcher
            tenants={accessibleTenants.map((t) => ({
              slug: t.slug,
              name: t.name,
              role: t.role,
            }))}
            currentSlug={session.tenant.slug}
          />
          <p className="truncate px-0.5 text-xs text-slate-500">{session.role}</p>
        </div>

        <nav className="flex-1 space-y-0.5 py-3">
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

        <div className="space-y-2 border-t border-slate-100 pt-3">
          {platformAdmin ? (
            <Link
              href="/admin"
              prefetch
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

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="w-full px-4 py-4 lg:px-6 lg:py-5">{children}</div>
      </main>
    </div>
  );
}
