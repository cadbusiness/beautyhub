import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
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
    supabase.from("modules").select("id, name").order("name"),
  ]);
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/plans" className="text-sm text-slate-500 hover:underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{plan.name}</h1>
      </div>

      <Card>
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
      </Card>
    </div>
  );
}
