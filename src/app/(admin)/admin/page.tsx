import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "tenants" | "plans" | "subscriptions" | "modules",
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

  const [tenants, activeSubs, plans, modules] = await Promise.all([
    count(supabase, "tenants"),
    count(supabase, "subscriptions", { column: "status", value: "active" }),
    count(supabase, "plans"),
    count(supabase, "modules"),
  ]);

  const stats = [
    { label: t("stats.tenants"), value: tenants, href: "/admin/tenants" },
    { label: t("stats.activeSubscriptions"), value: activeSubs, href: "/admin/tenants" },
    { label: t("stats.plans"), value: plans, href: "/admin/plans" },
    { label: t("stats.catalogModules"), value: modules, href: "/admin/plans" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-slate-400">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/admin/tenants">
          <span className="inline-flex h-10 items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100">
            {t("manageTenants")}
          </span>
        </Link>
        <Link href="/admin/plans">
          <span className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100">
            {t("managePlans")}
          </span>
        </Link>
      </div>
    </div>
  );
}
