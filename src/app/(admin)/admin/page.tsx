import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { countOpenSupportTickets } from "@/lib/platform/support";
import { ListPanel } from "@/components/ui/list-panel";
import { PageHeader } from "@/components/ui/page-header";

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "tenants" | "plans" | "subscriptions" | "modules" | "brands",
  filter?: { column: string; value: string },
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count: c } = await q;
  return c ?? 0;
}

export default async function AdminDashboardPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.dashboard");
  const supabase = await createClient();

  const [tenants, activeSubs, plans, modules, brands, openTickets] = await Promise.all([
    count(supabase, "tenants"),
    count(supabase, "subscriptions", { column: "status", value: "active" }),
    count(supabase, "plans"),
    count(supabase, "modules"),
    count(supabase, "brands"),
    countOpenSupportTickets(),
  ]);

  const stats = [
    { label: t("stats.tenants"), value: tenants, href: "/admin/tenants" },
    { label: t("stats.activeSubscriptions"), value: activeSubs, href: "/admin/subscriptions" },
    { label: t("stats.plans"), value: plans, href: "/admin/plans" },
    { label: t("stats.catalogModules"), value: modules, href: "/admin/modules" },
    { label: t("stats.brands"), value: brands, href: "/admin/brands" },
    { label: t("stats.openTickets"), value: openTickets, href: "/admin/support" },
  ];

  const quickLinks = [
    { href: "/admin/tenants", label: t("manageTenants") },
    { href: "/admin/subscriptions", label: t("manageSubscriptions") },
    { href: "/admin/team", label: t("manageTeam") },
    { href: "/admin/settings", label: t("manageSettings") },
  ];

  return (
    <ListPanel className="min-h-0 flex-1">
      <div className="border-b border-slate-200 px-4 py-6 lg:px-6">
        <PageHeader title={t("title")} description={t("description")} />
      </div>

      <div className="grid grid-cols-2 gap-6 border-b border-slate-200 px-4 py-6 sm:grid-cols-3 lg:grid-cols-6 lg:px-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 group-hover:text-slate-500">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-4 lg:px-6">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </ListPanel>
  );
}
