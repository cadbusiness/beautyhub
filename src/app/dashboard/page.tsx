import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import {
  getAccessibleTenants,
  getCurrentUser,
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";
import type { TeamRole } from "@/modules/types";
import { TenantPicker } from "./tenant-picker";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tenant = await getTenantContext();
  const platformAdmin = await isPlatformAdmin();
  const accessibleTenants = tenant ? [] : await getAccessibleTenants();

  let role: TeamRole | null = platformAdmin ? "platform_admin" : null;
  let enabledModuleIds: string[] = [];
  if (tenant) {
    role = (await getRoleForTenant(tenant.id)) ?? role;
    enabledModuleIds = await getEnabledModuleIds(tenant.id);
  }

  const nav = role && tenant ? getNavFor(enabledModuleIds, role) : [];
  const aiActions = role && tenant ? getAiActionsFor(enabledModuleIds, role) : [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 bg-slate-50 p-6 min-h-dvh">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {tenant ? tenant.name : "Zone plateforme"}
          </h1>
          <p className="text-sm text-slate-500">
            {user.email} {role ? `· ${role}` : "· aucun role"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {platformAdmin ? (
            <a
              href="/admin"
              className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700"
            >
              Administration
            </a>
          ) : null}
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Deconnexion
            </Button>
          </form>
        </div>
      </header>

      {!tenant && accessibleTenants.length > 0 ? (
        <TenantPicker
          tenants={accessibleTenants.map((t) => ({
            slug: t.slug,
            name: t.name,
            role: t.role,
          }))}
        />
      ) : null}

      {!tenant && !platformAdmin && accessibleTenants.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            Aucun institut resolu pour ce domaine et aucun acces plateforme.
            Connecte-toi sur le sous-domaine d&apos;un institut, ou demande un acces.
          </p>
        </Card>
      ) : null}

      {tenant ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Modules actives
            </h2>
            {nav.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Aucun module actif pour cet institut.
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {nav.map((item) => (
                  <li key={`${item.moduleId}-${item.href}`}>
                    <a
                      href={item.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-400">{item.moduleId}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Actions IA disponibles
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Agregees automatiquement depuis les modules actives.
            </p>
            {aiActions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Aucune action IA.</p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {aiActions.map((action) => (
                    <li key={action.name} className="text-sm">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                        {action.name}
                      </code>
                      <span className="ml-2 text-slate-500">{action.description}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/assistant"
                  className="mt-4 inline-flex text-sm font-medium text-violet-700 hover:underline"
                >
                  Ouvrir l&apos;assistant IA →
                </a>
              </>
            )}
          </Card>
        </section>
      ) : null}
    </main>
  );
}
