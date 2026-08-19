import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  fetchAppointmentsInRange,
  serializeCalendarAppointments,
} from "@/lib/institut/slots";

function todayYmd(timeZone = "Europe/Paris") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function roughUtcWindow(dateYmd: string) {
  const start = new Date(`${dateYmd}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 14);
  const end = new Date(`${dateYmd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  end.setUTCHours(end.getUTCHours() + 14);
  return { start, end };
}

function mondayOfWeek(dateYmd: string) {
  const anchor = new Date(`${dateYmd}T12:00:00.000Z`);
  const weekday = anchor.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysYmd(dateYmd, mondayOffset);
}

function weekUtcWindow(dateYmd: string) {
  const monday = mondayOfWeek(dateYmd);
  const start = new Date(`${monday}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 14);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCHours(end.getUTCHours() + 14);
  return { start, end, monday };
}

function localYmd(iso: string, timeZone = "Europe/Paris") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysYmd(dateYmd: string, days: number) {
  const d = new Date(`${dateYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function serializeMobileAppointment(a: ReturnType<typeof serializeCalendarAppointments>[number]) {
  return {
    id: a.id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    notes: a.notes,
    priceCents: a.price_cents,
    clientId: a.client_id,
    clientName: a.client?.full_name ?? a.client?.email ?? "Client",
    clientPhone: a.client?.phone ?? null,
    serviceId: a.service_id,
    serviceName: a.service?.name ?? "Prestation",
    serviceDurationMin: a.service?.duration_min ?? null,
    staffId: a.staff_id,
    staffName: a.staff?.full_name ?? null,
    serviceColor: a.service?.color ?? null,
    staffColor: a.staff?.color ?? null,
    resourceId: a.resource_id,
    resourceName: a.resource?.name ?? null,
  };
}

function computeDayStats(
  appointments: ReturnType<typeof serializeMobileAppointment>[],
) {
  const active = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "no_show",
  );
  return {
    total: appointments.length,
    scheduled: active.length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
    noShow: appointments.filter((a) => a.status === "no_show").length,
    revenueCents: appointments
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + (a.priceCents ?? 0), 0),
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const date = url.searchParams.get("date")?.trim() || todayYmd();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: "invalid_date", message: "Expected YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const includeWeek = url.searchParams.get("week") === "1";
    const { start, end } = roughUtcWindow(date);
    const weekWindow = weekUtcWindow(date);

    const [dayRows, weekRows, staffRes] = await Promise.all([
      fetchAppointmentsInRange(session.supabase, session.tenant.id, start, end),
      includeWeek
        ? fetchAppointmentsInRange(
            session.supabase,
            session.tenant.id,
            weekWindow.start,
            weekWindow.end,
          )
        : Promise.resolve([]),
      session.supabase
        .from("inst_staff")
        .select("id, full_name, color")
        .eq("tenant_id", session.tenant.id)
        .eq("is_active", true)
        .order("full_name"),
    ]);

    const daySerialized = serializeCalendarAppointments(dayRows)
      .filter((a) => localYmd(a.starts_at) === date)
      .map(serializeMobileAppointment);

    const appointments = daySerialized.sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );

    const now = Date.now();
    const next =
      appointments.find((a) => {
        const t = Date.parse(a.startsAt);
        return (
          Number.isFinite(t) &&
          t >= now - 30 * 60 * 1000 &&
          a.status !== "cancelled" &&
          a.status !== "no_show"
        );
      }) ?? null;

    const weekDays = includeWeek
      ? Array.from({ length: 7 }, (_, i) => {
          const dayDate = addDaysYmd(weekWindow.monday, i);
          const count = serializeCalendarAppointments(weekRows).filter(
            (a) =>
              localYmd(a.starts_at) === dayDate &&
              a.status !== "cancelled" &&
              a.status !== "no_show",
          ).length;
          return { date: dayDate, count };
        })
      : [];

    const staff = (staffRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.full_name,
      color: s.color,
    }));

    const resources = [
      ...new Map(
        appointments
          .filter((a) => a.resourceId && a.resourceName)
          .map((a) => [a.resourceId, { id: a.resourceId, name: a.resourceName }]),
      ).values(),
    ];

    return Response.json({
      date,
      tenant: {
        id: session.tenant.id,
        name: session.tenant.name,
        slug: session.tenant.slug,
      },
      stats: computeDayStats(appointments),
      staff,
      resources,
      weekDays,
      nextAppointment: next,
      appointments,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
