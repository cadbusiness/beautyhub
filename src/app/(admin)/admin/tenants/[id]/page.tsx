import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) notFound();

  const [{ data: sub }, { data: plans }, { data: modules }, { data: tenantModules }, { data: memberships }] =
    await Promise.all([
      supabase.from("subscriptions").select("plan_id, status").eq("tenant_id", id).maybeSingle(),
      supabase.from("plans").select("id, name").eq("is_active", true).order("price_cents"),
      supabase.from("modules").select("id, name, description").order("name"),
      supabase.from("tenant_modules").select("module_id, enabled").eq("tenant_id", id),
      supabase.from("memberships").select("role").eq("tenant_id", id),
    ]);

  const enabledMap = new Map(
    (tenantModules ?? []).map((m) => [m.module_id, m.enabled]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tenants" className="text-sm text-slate-500 hover:underline">
          ← Instituts
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {tenant.name}
        </h1>
      </div>

      <Card className="space-y-4">
        <h2 className="font-medium text-slate-900 dark:text-white">Informations</h2>
        <EditTenantForm tenant={tenant} />
        <p className="text-xs text-slate-400">
          Acces institut: <code>{tenant.slug}</code>.localhost:3000
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium text-slate-900 dark:text-white">Abonnement</h2>
        <form action={setTenantPlan} className="flex items-end gap-3">
          <input type="hidden" name="tenant_id" value={tenant.id} />
          <div className="flex-1 space-y-1">
            <label className="text-sm text-slate-500">Formule active</label>
            <Select name="plan_id" defaultValue={sub?.plan_id ?? ""}>
              <option value="">— Aucune —</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Appliquer</Button>
        </form>
        <p className="text-xs text-slate-400">
          Appliquer une formule active automatiquement ses modules inclus.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium text-slate-900 dark:text-white">Modules</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {(modules ?? []).map((m) => {
            const enabled = enabledMap.get(m.id) ?? false;
            return (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {m.name}
                  </p>
                  <p className="text-xs text-slate-500">{m.description}</p>
                </div>
                <form action={toggleTenantModule}>
                  <input type="hidden" name="tenant_id" value={tenant.id} />
                  <input type="hidden" name="module_id" value={m.id} />
                  <input type="hidden" name="enabled" value={(!enabled).toString()} />
                  <Button type="submit" variant={enabled ? "outline" : "primary"}>
                    {enabled ? "Desactiver" : "Activer"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="font-medium text-slate-900 dark:text-white">Equipe</h2>
        <p className="mt-2 text-sm text-slate-500">
          {(memberships ?? []).length} membre(s) :{" "}
          {(memberships ?? []).map((m) => m.role).join(", ") || "aucun"}
        </p>
      </Card>
    </div>
  );
}
