import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";

export default async function DashboardPage() {
  const tenant = await getTenantContext();
  const platformAdmin = await isPlatformAdmin();

  const role = tenant
    ? platformAdmin
      ? "platform_admin"
      : await getRoleForTenant(tenant.id)
    : null;

  const enabledModuleIds = tenant ? await getEnabledModuleIds(tenant.id) : [];
  const nav = role ? getNavFor(enabledModuleIds, role) : [];
  const aiActions = role ? getAiActionsFor(enabledModuleIds, role) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Accueil" description={tenant?.name} />

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Modules actives
          </h2>
          {nav.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucun module actif.</p>
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
            Actions IA
          </h2>
          {aiActions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Aucune action IA.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {aiActions.slice(0, 5).map((action) => (
                  <li key={action.name} className="text-sm text-slate-600">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                      {action.name}
                    </code>
                  </li>
                ))}
              </ul>
              <a
                href="/assistant"
                className="mt-4 inline-flex text-sm font-medium text-violet-700 hover:underline"
              >
                Ouvrir l&apos;assistant →
              </a>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
