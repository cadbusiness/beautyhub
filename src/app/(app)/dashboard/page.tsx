import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  dataTableCell,
  dataTableHead,
  dataTableRow,
} from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";

const MODULE_LABELS: Record<string, string> = {
  institut: "Institut",
  academie: "Académie",
};

const ROLE_LABELS: Record<string, string> = {
  tenant_owner: "Propriétaire",
  staff: "Équipe",
  coach: "Coach",
  brand_owner: "Marque",
  platform_admin: "Admin plateforme",
};

function actionLabel(action: { name: string; description: string }) {
  const labels: Record<string, string> = {
    "institut.create_client": "Créer un client",
    "institut.list_clients": "Lister les clients",
    "academie.list_courses": "Voir les formations",
    "academie.create_course": "Nouvelle formation",
  };
  return labels[action.name] ?? action.description.replace(/\.$/, "");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 lg:px-6">
      {children}
    </div>
  );
}

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

  const hasInstitut = enabledModuleIds.includes("institut");
  let kpis: { label: string; value: number; href: string }[] = [];

  if (tenant && hasInstitut) {
    const supabase = await createClient();
    const [clients, upcoming, services] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id),
      supabase
        .from("inst_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("starts_at", new Date().toISOString())
        .neq("status", "cancelled"),
      supabase
        .from("inst_services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_active", true),
    ]);

    kpis = [
      {
        label: "RDV à venir",
        value: upcoming.count ?? 0,
        href: "/institut/rendez-vous",
      },
      {
        label: "Clients",
        value: clients.count ?? 0,
        href: "/institut/clients",
      },
      {
        label: "Prestations actives",
        value: services.count ?? 0,
        href: "/institut/prestations",
      },
    ];
  }

  return (
    <ListPanel>
      {kpis.length > 0 ? (
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="px-4 py-5 transition-colors hover:bg-slate-50 lg:px-6"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {kpi.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                {kpi.value}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      <SectionTitle>Raccourcis</SectionTitle>
      <DataTable empty={nav.length === 0 ? "Aucun module actif." : undefined}>
        {nav.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Page</th>
                <th className={`hidden w-32 sm:table-cell ${dataTableHead}`}>Module</th>
                <th className={`w-12 ${dataTableHead}`} aria-hidden />
              </tr>
            </thead>
            <tbody>
              {nav.map((item) => (
                <tr key={`${item.moduleId}-${item.href}`} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <Link
                      href={item.href}
                      className="font-medium text-slate-900 hover:text-slate-600"
                    >
                      {item.label}
                    </Link>
                  </td>
                  <td className={`hidden text-slate-500 sm:table-cell ${dataTableCell}`}>
                    {MODULE_LABELS[item.moduleId] ?? item.moduleId}
                  </td>
                  <td className={`text-right text-slate-400 ${dataTableCell}`}>
                    <Link href={item.href} className="hover:text-slate-700" aria-label={item.label}>
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>

      {aiActions.length > 0 ? (
        <>
          <SectionTitle>Assistant</SectionTitle>
          <DataTable>
            <table className="w-full text-sm">
              <tbody>
                {aiActions.slice(0, 6).map((action) => (
                  <tr key={action.name} className={dataTableRow}>
                    <td className={dataTableCell}>
                      <p className="text-slate-900">{actionLabel(action)}</p>
                      <p className="text-xs text-slate-400">{action.description}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <div className="border-t border-slate-100 px-4 py-4 lg:px-6">
            <Link href="/assistant">
              <Button variant="outline" className="h-9">
                Ouvrir l&apos;assistant
              </Button>
            </Link>
          </div>
        </>
      ) : null}

      {tenant && role ? (
        <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 lg:px-6">
          {tenant.name}
          {ROLE_LABELS[role] ? ` · ${ROLE_LABELS[role]}` : null}
        </div>
      ) : null}
    </ListPanel>
  );
}
