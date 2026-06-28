import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchAppointmentsInRange } from "@/lib/institut/slots";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { AppointmentForm } from "./appointment-form";
import { CalendarView, type CalendarAppointment } from "./calendar-view";
import { setAppointmentStatus } from "../actions";

const STATUS: Record<string, string> = {
 booked: "Reserve",
 confirmed: "Confirme",
 completed: "Termine",
 cancelled: "Annule",
 no_show: "Absent",
};

type Joined = { name?: string; full_name?: string | null; color?: string | null } | null;

function pick(value: Joined | Joined[]): string {
 const v = Array.isArray(value) ? value[0] : value;
 return v?.name ?? v?.full_name ?? "-";
}

export default async function RendezVousPage({
 searchParams,
}: {
 searchParams: Promise<{ view?: string }>;
}) {
 const session = await requireModule("institut");
 const params = await searchParams;
 const view = params.view === "liste" ? "liste" : "calendrier";
 const supabase = await createClient();
 const tenantId = session.tenant.id;

 const now = new Date();
 const rangeStart = new Date(now);
 rangeStart.setDate(rangeStart.getDate() - 7);
 const rangeEnd = new Date(now);
 rangeEnd.setDate(rangeEnd.getDate() + 21);

 const [servicesRes, staffRes, resourcesRes, clientsRes, apptsRes, calendarAppts] =
 await Promise.all([
 supabase
 .from("inst_services")
 .select("id, name, duration_min, price_cents")
 .eq("tenant_id", tenantId)
 .eq("is_active", true)
 .order("name"),
 supabase
 .from("inst_staff")
 .select("id, full_name, color")
 .eq("tenant_id", tenantId)
 .eq("is_active", true)
 .order("full_name"),
 supabase
 .from("inst_resources")
 .select("id, name")
 .eq("tenant_id", tenantId)
 .eq("is_active", true)
 .order("name"),
 supabase
 .from("clients")
 .select("id, full_name, email")
 .eq("tenant_id", tenantId)
 .order("created_at", { ascending: false }),
 supabase
 .from("inst_appointments")
 .select(
 "id, starts_at, ends_at, status, price_cents, service:inst_services(name), staff:inst_staff(full_name), client:clients(full_name, email)",
 )
 .eq("tenant_id", tenantId)
 .order("starts_at", { ascending: true })
 .limit(50),
 fetchAppointmentsInRange(supabase, tenantId, rangeStart, rangeEnd),
 ]);

 const services = (servicesRes.data ?? []).map((s) => ({
 id: s.id,
 label: `${s.name} (${s.duration_min} min · ${formatPrice(s.price_cents)})`,
 }));
 const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, label: s.full_name }));
 const resources = (resourcesRes.data ?? []).map((r) => ({ id: r.id, label: r.name }));
 const clients = (clientsRes.data ?? []).map((c) => ({
 id: c.id,
 label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
 }));
 const appointments = apptsRes.data ?? [];

 const staffColumns = (staffRes.data ?? []).map((s) => ({
 id: s.id,
 label: s.full_name,
 color: s.color,
 }));
 const resourceColumns = (resourcesRes.data ?? []).map((r) => ({
 id: r.id,
 label: r.name,
 color: null,
 }));

 return (
 <div className="space-y-6">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <h1 className="text-2xl font-semibold text-slate-900">
 Rendez-vous
 </h1>
 <div className="flex gap-2">
 <Link href="/institut/rendez-vous?view=calendrier">
 <Button variant={view === "calendrier" ? "primary" : "outline"}>
 Calendrier
 </Button>
 </Link>
 <Link href="/institut/rendez-vous?view=liste">
 <Button variant={view === "liste" ? "primary" : "outline"}>
 Liste
 </Button>
 </Link>
 <Link href="/reserver" target="_blank">
 <Button variant="outline">Page publique ↗</Button>
 </Link>
 </div>
 </div>

 {view === "calendrier" ? (
 <CalendarView
 appointments={calendarAppts as CalendarAppointment[]}
 staffColumns={staffColumns}
 resourceColumns={resourceColumns}
 initialDate={now.toISOString().slice(0, 10)}
 />
 ) : (
 <div className="grid gap-6 md:grid-cols-[1fr_360px]">
 <div className="space-y-3">
 {appointments.length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">Aucun rendez-vous.</p>
 </Card>
 ) : (
 appointments.map((a) => (
 <Card key={a.id} className="space-y-2">
 <div className="flex items-start justify-between">
 <div>
 <p className="font-medium text-slate-900">
 {pick(a.service)}
 </p>
 <p className="text-sm text-slate-500">
 {formatDateTime(a.starts_at)} · {pick(a.client)} · {pick(a.staff)}
 </p>
 </div>
 <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
 {STATUS[a.status] ?? a.status}
 </span>
 </div>
 <form action={setAppointmentStatus} className="flex items-center gap-2">
 <input type="hidden" name="id" value={a.id} />
 <Select name="status" defaultValue={a.status} className="h-9 max-w-40">
 {Object.entries(STATUS).map(([value, label]) => (
 <option key={value} value={value}>
 {label}
 </option>
 ))}
 </Select>
 <Button variant="outline" type="submit" className="h-9">
 Mettre a jour
 </Button>
 </form>
 </Card>
 ))
 )}
 </div>

 <Card className="h-fit">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
 Nouveau rendez-vous
 </h2>
 <AppointmentForm
 clients={clients}
 services={services}
 staff={staff}
 resources={resources}
 />
 </Card>
 </div>
 )}
 </div>
 );
}
