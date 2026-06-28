import { requirePlatformAdmin } from "@/lib/auth/guards";
import { NavLink } from "@/components/app-shell/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold text-slate-900">BeautyHub</p>
          <p className="text-xs text-slate-500">Administration plateforme</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink href="/admin" label="Tableau de bord" />
          <NavLink href="/admin/tenants" label="Instituts" />
          <NavLink href="/admin/plans" label="Formules" />
        </nav>
        <div className="border-t border-slate-200 pt-4">
          <p className="px-2 pb-2 text-xs text-slate-400">{session.email}</p>
          <form action={signOut}>
            <Button variant="outline" type="submit" className="w-full">
              Deconnexion
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex min-h-0 w-full flex-1 flex-col px-4 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
