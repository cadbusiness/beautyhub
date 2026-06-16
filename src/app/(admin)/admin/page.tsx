import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

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
  const supabase = await createClient();

  const [tenants, activeSubs, plans, modules] = await Promise.all([
    count(supabase, "tenants"),
    count(supabase, "subscriptions", { column: "status", value: "active" }),
    count(supabase, "plans"),
    count(supabase, "modules"),
  ]);

  const stats = [
    { label: "Instituts", value: tenants, href: "/admin/tenants" },
    { label: "Abonnements actifs", value: activeSubs, href: "/admin/tenants" },
    { label: "Formules", value: plans, href: "/admin/plans" },
    { label: "Modules au catalogue", value: modules, href: "/admin/plans" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="text-sm text-slate-500">Vue d&apos;ensemble de la plateforme.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-slate-400">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {s.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/admin/tenants">
          <span className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">
            Gerer les instituts
          </span>
        </Link>
        <Link href="/admin/plans">
          <span className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100">
            Gerer les formules
          </span>
        </Link>
      </div>
    </div>
  );
}
