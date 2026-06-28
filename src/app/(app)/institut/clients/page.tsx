import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ClientForm } from "./client-form";

export default async function ClientsPage() {
 const session = await requireModule("institut");
 const supabase = await createClient();
 const { data: clients } = await supabase
 .from("clients")
 .select("id, full_name, email, phone, created_at")
 .eq("tenant_id", session.tenant.id)
 .order("created_at", { ascending: false });

 return (
 <div className="space-y-6">
 <h1 className="text-2xl font-semibold text-slate-900">
 Clients
 </h1>

 <div className="grid gap-6 md:grid-cols-[1fr_360px]">
 <Card className="overflow-hidden p-0">
 {(clients ?? []).length === 0 ? (
 <p className="p-6 text-sm text-slate-500">Aucun client pour le moment.</p>
 ) : (
 <table className="w-full text-sm">
 <thead className="border-b border-slate-200 text-left text-slate-500">
 <tr>
 <th className="px-4 py-3 font-medium">Nom</th>
 <th className="px-4 py-3 font-medium">Email</th>
 <th className="px-4 py-3 font-medium">Telephone</th>
 </tr>
 </thead>
 <tbody>
 {(clients ?? []).map((c) => (
 <tr key={c.id} className="border-b border-slate-100">
 <td className="px-4 py-3 text-slate-900">
 {c.full_name ?? "-"}
 </td>
 <td className="px-4 py-3 text-slate-600">{c.email}</td>
 <td className="px-4 py-3 text-slate-600">
 {c.phone ?? "-"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </Card>

 <Card className="h-fit">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Nouveau client
 </h2>
 <ClientForm />
 </Card>
 </div>
 </div>
 );
}
