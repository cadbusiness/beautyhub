import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRoleForTenant,
  isPlatformAdmin,
} from "@/lib/auth/session";
import { getEnabledModuleIds, getTenantContext } from "@/lib/tenant/context";
import { getNavFor } from "@/modules";
import { getAppShellData } from "@/lib/auth/team-session";
import { PosSessionBanner } from "@/components/app-shell/pos-session-status";
import { DashboardAnalytics } from "@/components/institut/dashboard-analytics";
import { fetchDashboardSnapshot } from "@/lib/institut/dashboard-stats";
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
        <p className="text-base font-semibold text-slate-900">
          {tenant?.name ?? "BeautyHub"}
        </p>

        {quickActions.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("shortcuts.title")}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{t("shortcuts.description")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-[3.25rem] flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-900">{action.label}</span>
                  <span className="mt-0.5 truncate text-xs text-slate-500">
                    {action.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
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
