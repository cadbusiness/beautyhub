import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getTeamProfile,
  profileDisplayName,
  profileInitial,
} from "@/lib/auth/profile";
import { getAppShellData } from "@/lib/auth/team-session";
import { ensureDefaultTenant } from "@/lib/tenant/ensure";
import { navMessageKey } from "@/lib/i18n/nav";
import { getAiActionsFor, getNavGroupsFor } from "@/modules";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppFooter } from "@/components/app-shell/app-footer";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AssistantPanel } from "@/components/app-shell/assistant-panel";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await ensureDefaultTenant();

  const shell = await getAppShellData();
  if (!shell) redirect("/login");

  const { session, accessibleTenants, posSession } = shell;
  const t = await getTranslations("shell");
  const tNav = await getTranslations("nav");
  const navGroups = getNavGroupsFor(session.enabledModuleIds, session.role).map(
    (group) => ({
      ...group,
      items: group.items.map((item) => {
        const labelKey = navMessageKey(item.href);
        const label = labelKey ? tNav(labelKey) : item.label;
        return { ...item, label };
      }),
    }),
  );
  const posOpenHref =
    posSession ? "/institut/caisse" : undefined;
  const profile = await getTeamProfile();
  const displayName = profileDisplayName(profile, user.email ?? null);
  const initial = profileInitial(displayName);
  const platformAdmin = session.role === "platform_admin";
  const aiActions = getAiActionsFor(session.enabledModuleIds, session.role).map(
    (a) => ({ name: a.name, description: a.description }),
  );

  const tenants = accessibleTenants.map((t) => ({
    slug: t.slug,
    name: t.name,
    role: t.role,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader
        email={user.email ?? null}
        role={session.role}
        platformAdmin={platformAdmin}
        tenants={tenants}
        currentSlug={session.tenant.slug}
        displayName={displayName}
        profileInitial={initial}
        posSession={posSession}
      />

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          homeLabel={t("home")}
          navGroups={navGroups}
          posOpenHref={posOpenHref}
        />

        <div className="flex min-w-0 flex-1">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
            <div className="flex min-h-0 w-full flex-1 flex-col px-4 lg:px-6">
              {children}
            </div>
            <AppFooter />
          </main>
          <AssistantPanel actions={aiActions} />
        </div>
      </div>
    </div>
  );
}
