import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ServiceForm } from "./service-form";
import { deleteService } from "../actions";

export default async function PrestationsPage() {
 const session = await requireModule("institut");
 const supabase = await createClient();
 const { data: services } = await supabase
 .from("inst_services")
 .select("id, name, description, duration_min, price_cents, currency, is_active")
 .eq("tenant_id", session.tenant.id)
 .order("created_at", { ascending: true });

 return (
 <div className="space-y-6">
 <h1 className="text-2xl font-semibold text-slate-900">
 Prestations
 </h1>

 <div className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 {(services ?? []).length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucune prestation pour le moment.</p>
 </Card>
 ) : (
 (services ?? []).map((s) => (
 <Card key={s.id} className="flex items-center justify-between">
 <div>
 <p className="font-medium text-slate-900">{s.name}</p>
 <p className="text-sm text-slate-500">
 {s.duration_min} min · {formatPrice(s.price_cents, s.currency)}
 </p>
 {s.description ? (
 <p className="mt-1 text-sm text-slate-400">{s.description}</p>
 ) : null}
 </div>
 <form action={deleteService}>
 <input type="hidden" name="id" value={s.id} />
 <Button variant="ghost" type="submit" className="text-red-600">
 Supprimer
 </Button>
 </form>
 </Card>
 ))
 )}
 </div>

 <Card className="h-fit">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Nouvelle prestation
 </h2>
 <ServiceForm />
 </Card>
 </div>
 </div>
 );
}
