import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";
import { getAppShellData } from "@/lib/auth/team-session";
import { PosSessionBanner } from "@/components/app-shell/pos-session-status";
import { Button } from "@/components/ui/button";
import { ListPanel } from "@/components/ui/list-panel";

const QUICK_ACTION_KEYS = [
  {
    href: "/institut/rendez-vous",
    labelKey: "appointments",
    descriptionKey: "appointments",
  },
  {
    href: "/institut/caisse",
    labelKey: "pos",
    descriptionKey: "pos",
  },
  {
    href: "/institut/clients",
    labelKey: "clients",
    descriptionKey: "clients",
  },
  {
    href: "/institut/prestations",
    labelKey: "services",
    descriptionKey: "services",
  },
  {
    href: "/academie/formations",
    labelKey: "courses",
    descriptionKey: "courses",
  },
  {
    href: "/academie/eleves",
    labelKey: "students",
    descriptionKey: "students",
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
  const t = await getTranslations("dashboard");
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

  const quickActions = QUICK_ACTION_KEYS.filter((action) =>
    nav.some((item) => item.href === action.href || item.href.startsWith(`${action.href}/`)),
  )
    .slice(0, 4)
    .map((action) => ({
      href: action.href,
      label: t(`quickActions.${action.labelKey}.label`),
      description: t(`quickActions.${action.descriptionKey}.description`),
    }));

  const shell = await getAppShellData();
  const posSession = shell?.posSession ?? null;

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
        label: t("kpis.upcomingAppointments"),
        value: upcoming.count ?? 0,
        href: "/institut/rendez-vous",
      },
      {
        label: t("kpis.clients"),
        value: clients.count ?? 0,
        href: "/institut/clients",
      },
      {
        label: t("kpis.services"),
        value: services.count ?? 0,
        href: "/institut/prestations",
      },
    ];
  }

  return (
    <ListPanel>
      {hasInstitut ? (
        posSession ? (
          <PosSessionBanner session={posSession} variant="open" />
        ) : (
          <PosSessionBanner variant="closed" />
        )
      ) : null}

      <div className="border-b border-slate-200 px-4 py-5 lg:px-6">
        <p className="text-base font-semibold text-slate-900">
          {tenant?.name ?? "BeautyHub"}
        </p>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {kpis.length > 0 ? (
        <DashboardSection
          title={t("kpis.title")}
          description={t("kpis.description")}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <Link
                key={kpi.href}
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
          title={t("quickActions.title")}
          description={t("quickActions.description")}
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
        <DashboardSection
          title={t("modules.title")}
          description={t("modules.emptyDescription")}
        >
          <p className="text-sm text-slate-500">{t("modules.emptyHint")}</p>
        </DashboardSection>
      ) : null}

      {aiActions.length > 0 ? (
        <DashboardSection title={t("assistant.title")}>
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">{t("assistant.heading")}</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {t("assistant.description")}
              </p>
            </div>
            <Link href="/assistant" className="shrink-0">
              <Button className="h-9 w-full sm:w-auto">{t("assistant.open")}</Button>
            </Link>
          </div>
        </DashboardSection>
      ) : null}
    </ListPanel>
  );
}
