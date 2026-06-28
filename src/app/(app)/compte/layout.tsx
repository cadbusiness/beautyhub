import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamSession } from "@/lib/auth/team-session";
import { canManageInstitutSettings } from "@/lib/auth/institut-settings";
import { ListPanel } from "@/components/ui/list-panel";
import { PageTabLinks, type PageTabLinkItem } from "@/components/ui/page-tabs";

function TabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export default async function CompteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [session, t, tRoles] = await Promise.all([
    getTeamSession(),
    getTranslations("account"),
    getTranslations("roles"),
  ]);

  const knownRoles = [
    "platform_admin",
    "brand_owner",
    "tenant_owner",
    "staff",
    "coach",
  ] as const;
  const roleText =
    session && knownRoles.includes(session.role as (typeof knownRoles)[number])
      ? tRoles(session.role as (typeof knownRoles)[number])
      : (session?.role ?? "");

  const showInstitut =
    session &&
    canManageInstitutSettings(session.role, session.enabledModuleIds);

  const tabs: PageTabLinkItem[] = [
    { href: "/compte", label: t("nav.profile"), exact: true },
    { href: "/compte/securite", label: t("nav.security"), exact: true },
  ];

  if (showInstitut) {
    tabs.push({ href: "/compte/institut", label: t("nav.institut") });
  }

  return (
    <ListPanel className="min-h-0 flex-1">
      <header className="border-b border-slate-200 px-6 py-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{t("subtitle")}</p>
          </div>
          {roleText ? (
            <span className="inline-flex w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {roleText}
            </span>
          ) : null}
        </div>
      </header>

      <Suspense fallback={<TabLinksFallback />}>
        <PageTabLinks items={tabs} />
      </Suspense>

      <div className="min-w-0 px-6 py-6 lg:px-8 lg:py-8">{children}</div>
    </ListPanel>
  );
}
