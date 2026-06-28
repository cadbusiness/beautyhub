import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchAppointmentsInRange } from "@/lib/institut/slots";
import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";
import { CalendarView, type CalendarAppointment } from "./calendar-view";
import { AppointmentsList } from "./appointments-list";

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

  const appointments = (apptsRes.data ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    status: a.status,
    price_cents: a.price_cents ?? 0,
    serviceName: pick(a.service),
    clientName: pick(a.client),
    staffName: pick(a.staff),
  }));

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
    <>
      <div className="-mx-4 border-b border-slate-200 bg-white lg:-mx-6">
        <ListToolbar
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/institut/rendez-vous?view=calendrier">
                <Button variant={view === "calendrier" ? "primary" : "outline"} className="h-9">
                  Calendrier
                </Button>
              </Link>
              <Link href="/institut/rendez-vous?view=liste">
                <Button variant={view === "liste" ? "primary" : "outline"} className="h-9">
                  Liste
                </Button>
              </Link>
              <Link href="/reserver" target="_blank">
                <Button variant="outline" className="h-9">
                  Page publique ↗
                </Button>
              </Link>
            </div>
          }
        >
          <span className="text-sm text-slate-500">Rendez-vous</span>
        </ListToolbar>
      </div>

      {view === "calendrier" ? (
        <div className="pt-4">
          <CalendarView
          appointments={calendarAppts as CalendarAppointment[]}
          staffColumns={staffColumns}
          resourceColumns={resourceColumns}
          initialDate={now.toISOString().slice(0, 10)}
          />
        </div>
      ) : (
        <AppointmentsList
          panelClassName="flex-1"
          appointments={appointments}
          clients={clients}
          services={services}
          staff={staff}
          resources={resources}
        />
      )}
    </>
  );
}
