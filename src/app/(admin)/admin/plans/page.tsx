import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { PlanForm } from "./plan-form";

export default async function PlansPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: plans }, { data: modules }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, name, price_cents, interval, is_active, modules")
      .is("brand_id", null)
      .order("price_cents"),
    supabase.from("modules").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        Formules
      </h1>

      <Card>
        {(plans ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Aucune formule.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                <th className="pb-2 font-medium">Formule</th>
                <th className="pb-2 font-medium">Prix</th>
                <th className="pb-2 font-medium">Modules</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {(plans ?? []).map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800/50"
                >
                  <td className="py-2">
                    <Link
                      href={`/admin/plans/${p.id}`}
                      className="font-medium text-slate-900 hover:underline dark:text-white"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">
                    {formatPrice(p.price_cents)}/{p.interval === "year" ? "an" : "mois"}
                  </td>
                  <td className="py-2 text-slate-500">{p.modules.join(", ") || "—"}</td>
                  <td className="py-2">
                    <span
                      className={
                        p.is_active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800"
                      }
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium text-slate-900 dark:text-white">Nouvelle formule</h2>
        <PlanForm modules={modules ?? []} />
      </Card>
    </div>
  );
}
