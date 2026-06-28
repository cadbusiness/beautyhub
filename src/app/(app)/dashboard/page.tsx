import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getAiActionsFor, getNavFor } from "@/modules";
import { getAppShellData } from "@/lib/auth/team-session";
import { PosSessionBanner } from "@/components/app-shell/pos-session-status";
import { DashboardAnalytics } from "@/components/institut/dashboard-analytics";
import { fetchDashboardSnapshot } from "@/lib/institut/dashboard-stats";
import { Button } from "@/components/ui/button";
import { ListPanel } from "@/components/ui/list-panel";

const QUICK_ACTION_KEYS = [
  {
    href: "/institut/rendez-vous",
    labelKey: "appointments",
  },
  {
    href: "/institut/caisse",
    labelKey: "pos",
  },
  {
    href: "/institut/clients",
    labelKey: "clients",
  },
  {
    href: "/institut/prestations",
    labelKey: "services",
  },
  {
    href: "/academie/formations",
    labelKey: "courses",
  },
  {
    href: "/academie/eleves",
    labelKey: "students",
  },
] as const;

function DashboardSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-6 lg:px-6">
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
    }));

  const shell = await getAppShellData();
  const posSession = shell?.posSession ?? null;

  const hasInstitut = enabledModuleIds.includes("institut");
  let dashboardSnapshot = null;

  if (tenant && hasInstitut) {
    const supabase = await createClient();
    const locale = await getLocale();
    dashboardSnapshot = await fetchDashboardSnapshot(
      supabase,
      tenant.id,
      "week",
      locale,
    );
  }

  const hasHeaderActions = quickActions.length > 0 || aiActions.length > 0;

  return (
    <ListPanel>
      {hasInstitut ? (
        posSession ? (
          <PosSessionBanner session={posSession} variant="open" />
        ) : (
          <PosSessionBanner variant="closed" />
        )
      ) : null}

      <div className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-semibold text-slate-900">
            {tenant?.name ?? "BeautyHub"}
          </p>
          {hasHeaderActions ? (
            <div className="flex flex-wrap items-center gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  {action.label}
                </Link>
              ))}
              {aiActions.length > 0 ? (
                <Link href="/assistant" className="shrink-0">
                  <Button variant="outline" className="h-8 px-3">
                    {t("assistant.openShort")}
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {dashboardSnapshot ? (
        <DashboardSection
          title={t("analytics.title")}
          description={t("analytics.description")}
        >
          <DashboardAnalytics initialSnapshot={dashboardSnapshot} />
        </DashboardSection>
      ) : navHrefs.size === 0 ? (
        <DashboardSection
          title={t("modules.title")}
          description={t("modules.emptyDescription")}
        >
          <p className="text-sm text-slate-500">{t("modules.emptyHint")}</p>
        </DashboardSection>
      ) : null}
    </ListPanel>
  );
}
