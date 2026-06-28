import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { todayDateString } from "@/lib/date";
import { fetchAppointmentsInRange, serializeCalendarAppointments } from "@/lib/institut/slots";
import { ListPanel } from "@/components/ui/list-panel";
import { PageTabLinks } from "@/components/ui/page-tabs";
import { formatPrice } from "@/lib/utils";
import { CalendarView } from "./calendar-view";
import { AppointmentsList } from "./appointments-list";

const RDV_TAB_HREFS = [
  { href: "/institut/rendez-vous", exact: true as const },
  { href: "/institut/rendez-vous?view=liste" },
];

function TabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export default async function RendezVousPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const t = await getTranslations("appointments.tabs");
  const RDV_TABS = [
    { label: t("calendar"), ...RDV_TAB_HREFS[0] },
    { label: t("list"), ...RDV_TAB_HREFS[1] },
  ];
  const session = await requireModule("institut");
  const params = await searchParams;
  const view = params.view === "liste" ? "liste" : "calendrier";
  const tenantId = session.tenant.id;

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 35);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 35);

  const supabase = await createClient();

  let catalogServices: Array<{
    id: string;
    name: string;
    duration_min: number;
    price_cents: number;
    visibility?: string;
  }> = [];

  const servicesWithVisibility = await supabase
    .from("inst_services")
    .select("id, name, duration_min, price_cents, visibility")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (servicesWithVisibility.error) {
    const fallback = await supabase
      .from("inst_services")
      .select("id, name, duration_min, price_cents")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");
    catalogServices = fallback.data ?? [];
  } else {
    catalogServices = (servicesWithVisibility.data ?? []).filter(
      (s) => s.visibility !== "extra_only",
    );
  }

  const [staffRes, resourcesRes, clientsRes, apptsRes, calendarAppts] =
    await Promise.all([
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
        .select("id, starts_at, ends_at, status, price_cents, staff_id, service_id, client_id")
        .eq("tenant_id", tenantId)
        .order("starts_at", { ascending: true })
        .limit(50),
      fetchAppointmentsInRange(supabase, tenantId, rangeStart, rangeEnd)
        .then(serializeCalendarAppointments)
        .catch(() => []),
    ]);

  const services = catalogServices.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.duration_min} min · ${formatPrice(s.price_cents)})`,
    duration_min: s.duration_min,
    price_cents: s.price_cents,
  }));
  const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, label: s.full_name }));
  const resources = (resourcesRes.data ?? []).map((r) => ({ id: r.id, label: r.name }));
  const clients = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
  }));

  const staffMap = new Map((staffRes.data ?? []).map((s) => [s.id, s.full_name]));
  const serviceMap = new Map(catalogServices.map((s) => [s.id, s.name]));
  const clientMap = new Map(
    (clientsRes.data ?? []).map((c) => [c.id, c.full_name ?? c.email]),
  );

  const appointments = (apptsRes.data ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    status: a.status,
    price_cents: a.price_cents ?? 0,
    serviceName: (a.service_id && serviceMap.get(a.service_id)) || "-",
    clientName: (a.client_id && clientMap.get(a.client_id)) || "-",
    staffName: (a.staff_id && staffMap.get(a.staff_id)) || "-",
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
    <ListPanel>
      <Suspense fallback={<TabLinksFallback />}>
        <PageTabLinks items={RDV_TABS} />
      </Suspense>

      {view === "calendrier" ? (
        <CalendarView
          initialAppointments={calendarAppts}
          staffColumns={staffColumns}
          resourceColumns={resourceColumns}
          services={services}
          staff={staff}
          resources={resources}
          clients={clients}
          initialDate={todayDateString()}
        />
      ) : (
        <AppointmentsList
          appointments={appointments}
          clients={clients}
          services={services}
          staff={staff}
          resources={resources}
        />
      )}
    </ListPanel>
  );
}
