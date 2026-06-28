import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ListPanel } from "@/components/ui/list-panel";
import { EditTenantForm } from "./edit-tenant-form";
import { setTenantPlan, toggleTenantModule } from "../../actions";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations("admin.tenants.detail");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, brand_id")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) notFound();

  const [{ data: sub }, { data: plans }, { data: modules }, { data: tenantModules }, { data: memberships }, { data: brand }, apptCount] =
    await Promise.all([
      supabase.from("subscriptions").select("plan_id, status").eq("tenant_id", id).maybeSingle(),
      supabase.from("plans").select("id, name, limits, features").eq("is_active", true).order("price_cents"),
      supabase.from("modules").select("id, name, description").order("name"),
      supabase.from("tenant_modules").select("module_id, enabled").eq("tenant_id", id),
      supabase.from("memberships").select("role").eq("tenant_id", id),
      supabase.from("brands").select("name").eq("id", tenant.brand_id).maybeSingle(),
      (async () => {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("inst_appointments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", id)
          .gte("created_at", start.toISOString())
          .neq("status", "cancelled");
        return count ?? 0;
      })(),
    ]);

  const activePlan = sub?.plan_id
    ? (plans ?? []).find((p) => p.id === sub.plan_id) ?? null
    : null;
  const planData = activePlan as
    | { name?: string; limits?: Record<string, number | null>; features?: Record<string, boolean> }
    | null;
  const rdvLimit = planData?.limits?.appointments_per_month;
  const rdvUsage = apptCount as number;

  const enabledMap = new Map(
    (tenantModules ?? []).map((m) => [m.module_id, m.enabled]),
  );

  const roles = (memberships ?? []).map((m) => m.role).join(", ") || t("teamNone");

  return (
    <ListPanel className="min-h-0 flex-1">
      <div className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants" className="text-sm text-slate-500 hover:underline">
            {t("back")}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{tenant.name}</h1>
        </div>
        {brand ? (
          <p className="mt-1 text-xs text-slate-500">
            {t("brandLabel")}: {brand.name}
          </p>
        ) : null}
      </div>

      <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <h2 className="text-sm font-medium text-slate-900">{t("info")}</h2>
        <div className="mt-3 max-w-lg">
          <EditTenantForm tenant={tenant} />
        </div>
        <p className="mt-2 text-xs text-slate-400">{t("accessHint", { slug: tenant.slug })}</p>
      </section>

      <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <h2 className="text-sm font-medium text-slate-900">{t("usage")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("usageThisMonth", { count: rdvUsage })}
          {rdvLimit != null
            ? t("usageLimit", { limit: rdvLimit, plan: planData?.name ?? "—" })
            : t("usageUnlimited")}
        </p>
        {planData?.features ? (
          <ul className="mt-2 text-xs text-slate-500">
            {Object.entries(planData.features).map(([k, v]) => (
              <li key={k}>
                {k}: {v ? t("featureActive") : t("featureInactive")}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <h2 className="text-sm font-medium text-slate-900">{t("subscription")}</h2>
        <form action={setTenantPlan} className="mt-3 flex max-w-lg items-end gap-3">
          <input type="hidden" name="tenant_id" value={tenant.id} />
          <div className="flex-1 space-y-1">
            <label className="text-sm text-slate-500">{t("activePlan")}</label>
            <Select name="plan_id" defaultValue={sub?.plan_id ?? ""}>
              <option value="">{t("noPlan")}</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">{t("applyPlan")}</Button>
        </form>
        <p className="mt-2 text-xs text-slate-400">{t("applyPlanHint")}</p>
      </section>

      <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
        <h2 className="text-sm font-medium text-slate-900">{t("modules")}</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {(modules ?? []).map((m) => {
            const enabled = enabledMap.get(m.id) ?? false;
            return (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>
                <form action={toggleTenantModule}>
                  <input type="hidden" name="tenant_id" value={tenant.id} />
                  <input type="hidden" name="module_id" value={m.id} />
                  <input type="hidden" name="enabled" value={(!enabled).toString()} />
                  <Button type="submit" variant={enabled ? "outline" : "primary"}>
                    {enabled ? t("disable") : t("enable")}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 py-4 lg:px-6">
        <h2 className="text-sm font-medium text-slate-900">{t("team")}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {t("teamCount", { count: (memberships ?? []).length, roles })}
        </p>
      </section>
    </ListPanel>
  );
}
