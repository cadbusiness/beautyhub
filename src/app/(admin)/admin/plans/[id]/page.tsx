import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ListPanel } from "@/components/ui/list-panel";
import { PlanForm } from "../plan-form";

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const t = await getTranslations("admin.plans");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: plan }, { data: modules }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, price_cents, interval, is_active, modules, limits, features")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("modules").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (!plan) notFound();

  return (
    <ListPanel className="min-h-0 flex-1">
      <div className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/plans" className="text-sm text-slate-500 hover:underline">
            {t("back")}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{plan.name}</h1>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-6">
        <PlanForm
          modules={modules ?? []}
          plan={{
            id: plan.id,
            name: plan.name,
            price_cents: plan.price_cents,
            interval: plan.interval,
            is_active: plan.is_active,
            modules: plan.modules,
            limits: (plan.limits as Record<string, number | null>) ?? {},
            features: (plan.features as Record<string, boolean>) ?? {},
          }}
        />
      </div>
    </ListPanel>
  );
}
