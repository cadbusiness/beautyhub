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
import { getAiActionsFor, getNavFor } from "@/modules";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppFooter } from "@/components/app-shell/app-footer";
import { NavLink } from "@/components/app-shell/nav-link";
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

  const { session, accessibleTenants } = shell;
  const nav = getNavFor(session.enabledModuleIds, session.role);
  const t = await getTranslations("shell");
  const tNav = await getTranslations("nav");
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
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white py-4 lg:w-56">
          <nav className="flex-1 space-y-0.5 px-3">
            <NavLink href="/dashboard" label={t("home")} exact />
            {nav.map((item) => {
              const labelKey = navMessageKey(item.href);
              const label = labelKey ? tNav(labelKey) : item.label;
              return (
                <NavLink
                  key={`${item.moduleId}-${item.href}`}
                  href={item.href}
                  label={label}
                  exact={item.exact}
                />
              );
            })}
          </nav>
        </aside>

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
