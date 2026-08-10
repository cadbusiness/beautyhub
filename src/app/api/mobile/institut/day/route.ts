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

/** Bornes UTC larges autour d'un jour civil Paris, filtrées ensuite. */
function roughUtcWindow(dateYmd: string) {
  const start = new Date(`${dateYmd}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 14);
  const end = new Date(`${dateYmd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  end.setUTCHours(end.getUTCHours() + 14);
  return { start, end };
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

    const { start, end } = roughUtcWindow(date);
    const rows = await fetchAppointmentsInRange(
      session.supabase,
      session.tenant.id,
      start,
      end,
    );
    const appointments = serializeCalendarAppointments(rows)
      .filter((a) => localYmd(a.starts_at) === date)
      .map((a) => ({
        id: a.id,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        status: a.status,
        notes: a.notes,
        priceCents: a.price_cents,
        clientName: a.client?.full_name ?? a.client?.email ?? "Client",
        serviceName: a.service?.name ?? "Prestation",
        staffName: a.staff?.full_name ?? null,
        serviceColor: a.service?.color ?? null,
      }));

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

    return Response.json({
      date,
      tenant: {
        id: session.tenant.id,
        name: session.tenant.name,
        slug: session.tenant.slug,
      },
      nextAppointment: next,
      appointments,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
