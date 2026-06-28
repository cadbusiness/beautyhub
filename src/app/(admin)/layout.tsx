import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  getTeamProfile,
  profileDisplayName,
  profileInitial,
} from "@/lib/auth/profile";
import { NavLink } from "@/components/app-shell/nav-link";
import { AppFooter } from "@/components/app-shell/app-footer";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();
  const [t, tNav, tRoles, profile] = await Promise.all([
    getTranslations("admin.layout"),
    getTranslations("nav"),
    getTranslations("roles"),
    getTeamProfile(),
  ]);

  const displayName = profileDisplayName(profile, session.email);
  const initial = profileInitial(displayName);

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold text-slate-900">BeautyHub</p>
          <p className="text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink href="/admin" label={tNav("adminOverview")} />
          <NavLink href="/admin/tenants" label={tNav("adminTenants")} />
          <NavLink href="/admin/plans" label={tNav("adminPlans")} />
          <NavLink href="/admin/support" label={tNav("adminSupport")} />
          <NavLink href="/admin/settings" label={tNav("adminSettings")} />
        </nav>
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <LocaleSwitcher />
          <UserMenu
            email={session.email}
            roleText={tRoles("platform_admin")}
            displayName={displayName}
            initial={initial}
            align="left"
            variant="sidebar"
          />
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex min-h-0 w-full flex-1 flex-col px-4 lg:px-6">
          {children}
        </div>
        <AppFooter />
      </main>
    </div>
  );
}
