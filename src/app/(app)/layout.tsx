import { requireTenantSession } from "@/lib/auth/guards";
import { getNavFor } from "@/modules";
import { NavLink } from "@/components/app-shell/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenantSession();
  const nav = getNavFor(session.enabledModuleIds, session.role);

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {session.tenant.name}
          </p>
          <p className="text-xs text-slate-500">{session.role}</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink href="/dashboard" label="Accueil" />
          {nav.map((item) => (
            <NavLink
              key={`${item.moduleId}-${item.href}`}
              href={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <form action={signOut} className="pt-4">
          <Button variant="outline" type="submit" className="w-full">
            Deconnexion
          </Button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-8">{children}</div>
      </main>
    </div>
  );
}
