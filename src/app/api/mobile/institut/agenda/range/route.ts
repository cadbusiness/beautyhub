import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  fetchAppointmentsInRange,
  serializeCalendarAppointments,
} from "@/lib/institut/slots";
import { serializeMobileAppointment } from "@/lib/mobile/institut-appointments";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdBoundsUtc(fromYmd: string, toYmd: string) {
  const start = new Date(`${fromYmd}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - 14);
  const end = new Date(`${toYmd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
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

/**
 * Retourne tous les RDV entre `from` et `to` inclus, format\u00e9s pour l'app mobile.
 * Utilis\u00e9 par les vues semaine et mois de l'agenda mobile.
 * Bornes limit\u00e9es \u00e0 62 jours pour prot\u00e9ger la DB.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return Response.json(
        { error: "invalid_range", message: "Expected from=YYYY-MM-DD&to=YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (to < from) {
      return Response.json(
        { error: "invalid_range", message: "to must be >= from" },
        { status: 400 },
      );
    }
    const dayDiff = Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        (24 * 3600 * 1000),
    );
    if (dayDiff > 62) {
      return Response.json(
        { error: "range_too_wide", message: "Max 62 days" },
        { status: 400 },
      );
    }

    const { start, end } = ymdBoundsUtc(from, to);
    const rows = await fetchAppointmentsInRange(
      session.supabase,
      session.tenant.id,
      start,
      end,
    );

    const serialized = serializeCalendarAppointments(rows)
      .filter((a) => {
        const day = localYmd(a.starts_at);
        return day >= from && day <= to;
      })
      .map(serializeMobileAppointment)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

    return Response.json({
      from,
      to,
      tenant: {
        id: session.tenant.id,
        name: session.tenant.name,
        slug: session.tenant.slug,
      },
      appointments: serialized,
    });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
