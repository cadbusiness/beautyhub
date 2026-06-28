import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  getTeamProfile,
  profileDisplayName,
  profileInitial,
} from "@/lib/auth/profile";
import { countOpenSupportTickets } from "@/lib/platform/support";
import { AdminHeader } from "@/components/admin-shell/admin-header";
import { AdminSidebar } from "@/components/admin-shell/admin-sidebar";
import { AppFooter } from "@/components/app-shell/app-footer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();
  const [tRoles, profile, openTicketCount] = await Promise.all([
    getTranslations("roles"),
    getTeamProfile(),
    countOpenSupportTickets(),
  ]);

  const displayName = profileDisplayName(profile, session.email);
  const initial = profileInitial(displayName);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AdminHeader
        email={session.email}
        roleText={tRoles("platform_admin")}
        displayName={displayName}
        profileInitial={initial}
      />

      <div className="flex min-h-0 flex-1">
        <AdminSidebar openTicketCount={openTicketCount} />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          <div className="flex min-h-0 w-full flex-1 flex-col px-4 lg:px-6">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
