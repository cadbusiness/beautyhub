import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamSession } from "@/lib/auth/team-session";
import { ListPanel } from "@/components/ui/list-panel";
import { AccountNav } from "./account-nav";

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

  const navItems = [
    { href: "/compte", label: t("nav.profile"), exact: true as const },
    { href: "/compte/securite", label: t("nav.security") },
  ];

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

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="px-6 py-5 lg:sticky lg:top-14 lg:px-5 lg:py-8">
            <AccountNav items={navItems} />
          </div>
        </aside>

        <main className="min-w-0 px-6 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </ListPanel>
  );
}
