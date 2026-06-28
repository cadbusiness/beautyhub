import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function InstitutHome() {
 const session = await requireModule("institut");
 const supabase = await createClient();
 const tenantId = session.tenant.id;

 const [services, clients, upcoming] = await Promise.all([
 supabase
 .from("inst_services")
 .select("id", { count: "exact", head: true })
 .eq("tenant_id", tenantId),
 supabase
 .from("clients")
 .select("id", { count: "exact", head: true })
 .eq("tenant_id", tenantId),
 supabase
 .from("inst_appointments")
 .select("id", { count: "exact", head: true })
 .eq("tenant_id", tenantId)
 .gte("starts_at", new Date().toISOString())
 .neq("status", "cancelled"),
 ]);

 const stats = [
 { label: "Prestations", value: services.count ?? 0, href: "/institut/prestations" },
 { label: "Clients", value: clients.count ?? 0, href: "/institut/clients" },
 { label: "RDV a venir", value: upcoming.count ?? 0, href: "/institut/rendez-vous" },
 ];

 return (
 <div className="space-y-6">
 <h1 className="text-2xl font-semibold text-slate-900">
 Institut
 </h1>
 <div className="grid gap-4 sm:grid-cols-3">
 {stats.map((s) => (
 <Link key={s.label} href={s.href}>
 <Card className="transition-colors hover:border-slate-400">
 <p className="text-sm text-slate-500">{s.label}</p>
 <p className="mt-2 text-3xl font-semibold text-slate-900">
 {s.value}
 </p>
 </Card>
 </Link>
 ))}
 </div>
 </div>
 );
}
