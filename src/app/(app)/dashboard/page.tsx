import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";
import { Button } from "@/components/ui/button";
import { ListPanel } from "@/components/ui/list-panel";

const QUICK_ACTIONS = [
  {
    href: "/institut/rendez-vous",
    label: "Rendez-vous",
    description: "Planning et réservations",
  },
  {
    href: "/institut/caisse",
    label: "Caisse",
    description: "Encaisser une vente",
  },
  {
    href: "/institut/clients",
    label: "Clients",
    description: "Fiches et coordonnées",
  },
  {
    href: "/institut/prestations",
    label: "Prestations",
    description: "Services et tarifs",
  },
  {
    href: "/academie/formations",
    label: "Formations",
    description: "Catalogue académie",
  },
  {
    href: "/academie/eleves",
    label: "Élèves",
    description: "Inscriptions en cours",
  },
] as const;

function DashboardSection({
  title,
  description,
  children,
  muted = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      className={
        muted
          ? "border-t border-slate-200 bg-slate-50/80 px-4 py-6 lg:px-6"
          : "border-t border-slate-200 px-4 py-6 lg:px-6"
      }
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
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
  const navHrefs = new Set(nav.map((item) => item.href));

  const quickActions = QUICK_ACTIONS.filter((action) =>
    nav.some((item) => item.href === action.href || item.href.startsWith(`${action.href}/`)),
  ).slice(0, 4);

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
        label: "Prestations",
        value: services.count ?? 0,
        href: "/institut/prestations",
      },
    ];
  }

  return (
    <ListPanel>
      <div className="border-b border-slate-200 px-4 py-5 lg:px-6">
        <p className="text-base font-semibold text-slate-900">
          {tenant?.name ?? "BeautyHub"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Vue d&apos;ensemble — utilisez le menu à gauche pour naviguer.
        </p>
      </div>

      {kpis.length > 0 ? (
        <DashboardSection
          title="Indicateurs"
          description="Chiffres clés de votre institut."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/50"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {kpi.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-800">
                  {kpi.value}
                </p>
              </Link>
            ))}
          </div>
        </DashboardSection>
      ) : null}

      {quickActions.length > 0 ? (
        <DashboardSection
          title="Actions rapides"
          description="Les tâches les plus fréquentes, sans repasser par tout le menu."
          muted
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/80"
              >
                <p className="font-medium text-slate-900 group-hover:text-slate-700">
                  {action.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">{action.description}</p>
              </Link>
            ))}
          </div>
        </DashboardSection>
      ) : navHrefs.size === 0 ? (
        <DashboardSection title="Modules" description="Aucun module actif pour le moment.">
          <p className="text-sm text-slate-500">
            Contactez votre administrateur pour activer les modules institut ou académie.
          </p>
        </DashboardSection>
      ) : null}

      {aiActions.length > 0 ? (
        <DashboardSection title="Assistant">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">Pilotage assisté par IA</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Clients, formations, planning — posez une demande ou choisissez une action
                prédéfinie dans l&apos;assistant.
              </p>
            </div>
            <Link href="/assistant" className="shrink-0">
              <Button className="h-9 w-full sm:w-auto">Ouvrir l&apos;assistant</Button>
            </Link>
          </div>
        </DashboardSection>
      ) : null}
    </ListPanel>
  );
}
