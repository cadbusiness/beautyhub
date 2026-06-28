import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CreateTenantForm } from "./create-tenant-form";

interface TenantRow {
 id: string;
 name: string;
 slug: string;
 subscriptions: { status: string; plans: { name: string } | null } | null;
 tenant_modules: { enabled: boolean }[];
}

export default async function TenantsPage() {
 await requirePlatformAdmin();
 const supabase = await createClient();

 const [{ data: tenants }, { data: plans }] = await Promise.all([
 supabase
 .from("tenants")
 .select(
 "id, name, slug, subscriptions(status, plans(name)), tenant_modules(enabled)",
 )
 .order("created_at", { ascending: false }),
 supabase
 .from("plans")
 .select("id, name")
 .eq("is_active", true)
 .order("price_cents"),
 ]);

 const rows = (tenants ?? []) as unknown as TenantRow[];

 return (
 <div className="space-y-6">
 <h1 className="text-2xl font-semibold text-slate-900">
 Instituts
 </h1>

 <Card>
 {rows.length === 0 ? (
 <p className="text-sm text-slate-500">Aucun institut pour le moment.</p>
 ) : (
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-slate-200 text-left text-slate-500">
 <th className="pb-2 font-medium">Institut</th>
 <th className="pb-2 font-medium">Identifiant</th>
 <th className="pb-2 font-medium">Formule</th>
 <th className="pb-2 font-medium">Modules actifs</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((t) => (
 <tr
 key={t.id}
 className="border-b border-slate-100 last:border-0"
 >
 <td className="py-2">
 <Link
 href={`/admin/tenants/${t.id}`}
 className="font-medium text-slate-900 hover:underline"
 >
 {t.name}
 </Link>
 </td>
 <td className="py-2 text-slate-500">{t.slug}</td>
 <td className="py-2 text-slate-500">
 {t.subscriptions?.plans?.name ?? "—"}
 </td>
 <td className="py-2 text-slate-500">
 {t.tenant_modules.filter((m) => m.enabled).length}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </Card>

 <Card className="space-y-4">
 <h2 className="font-medium text-slate-900">
 Nouvel institut
 </h2>
 <CreateTenantForm plans={plans ?? []} />
 </Card>
 </div>
 );
}
