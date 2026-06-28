import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaffForm } from "./staff-form";
import { ResourceForm } from "./resource-form";
import { WorkingHoursForm } from "./working-hours-form";
import { deleteStaffMember, deleteResource } from "../actions";

export default async function EquipePage() {
 const session = await requireModule("institut");
 const supabase = await createClient();
 const tenantId = session.tenant.id;

 const [staffRes, resourcesRes, hoursRes] = await Promise.all([
 supabase
 .from("inst_staff")
 .select("id, full_name, email, color, is_active")
 .eq("tenant_id", tenantId)
 .order("full_name"),
 supabase
 .from("inst_resources")
 .select("id, name, is_active")
 .eq("tenant_id", tenantId)
 .order("name"),
 supabase
 .from("inst_working_hours")
 .select("weekday, start_time, end_time")
 .eq("tenant_id", tenantId)
 .is("staff_id", null)
 .order("weekday"),
 ]);

 const staff = staffRes.data ?? [];
 const resources = resourcesRes.data ?? [];
 const hours = hoursRes.data ?? [];

 return (
 <div className="space-y-8">
 <div>
 <h1 className="text-2xl font-semibold text-slate-900">Equipe</h1>
 <p className="text-sm text-slate-500">
 Personnel, cabines et horaires d&apos;ouverture de l&apos;institut.
 </p>
 </div>

 <section className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
 Personnel
 </h2>
 {staff.length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucun membre du personnel.</p>
 </Card>
 ) : (
 staff.map((s) => (
 <Card key={s.id} className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {s.color ? (
 <span
 className="h-3 w-3 rounded-full"
 style={{ backgroundColor: s.color }}
 />
 ) : null}
 <div>
 <p className="font-medium text-slate-900">{s.full_name}</p>
 <p className="text-sm text-slate-500">{s.email ?? "—"}</p>
 </div>
 </div>
 <form action={deleteStaffMember}>
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
 <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Ajouter du personnel
 </h3>
 <StaffForm />
 </Card>
 </section>

 <section className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
 Cabines / ressources
 </h2>
 {resources.length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucune cabine configuree.</p>
 </Card>
 ) : (
 resources.map((r) => (
 <Card key={r.id} className="flex items-center justify-between">
 <p className="font-medium text-slate-900">{r.name}</p>
 <form action={deleteResource}>
 <input type="hidden" name="id" value={r.id} />
 <Button variant="ghost" type="submit" className="text-red-600">
 Supprimer
 </Button>
 </form>
 </Card>
 ))
 )}
 </div>
 <Card className="h-fit">
 <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Ajouter une cabine
 </h3>
 <ResourceForm />
 </Card>
 </section>

 <section className="space-y-4">
 <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
 Horaires d&apos;ouverture (institut)
 </h2>
 <Card>
 <WorkingHoursForm hours={hours} />
 </Card>
 </section>
 </div>
 );
}
