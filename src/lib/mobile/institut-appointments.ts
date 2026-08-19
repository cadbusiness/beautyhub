import type { serializeCalendarAppointments } from "@/lib/institut/slots";

type CalendarAppointment = ReturnType<typeof serializeCalendarAppointments>[number];

/** Format retourn\u00e9 par les routes mobiles pour un RDV (utilis\u00e9 par /day et /agenda/range). */
export function serializeMobileAppointment(a: CalendarAppointment) {
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
    clientEmail: a.client?.email ?? null,
    serviceId: a.service_id,
    serviceName: a.service?.name ?? "Prestation",
    serviceDurationMin: a.service?.duration_min ?? null,
    staffId: a.staff_id,
    staffName: a.staff?.full_name ?? null,
    serviceColor: a.service?.color ?? null,
    staffColor: a.staff?.color ?? null,
    resourceId: a.resource_id,
    resourceName: a.resource?.name ?? null,
    extras: (a.extras ?? []).map((e) => ({
      serviceId: e.service_id,
      quantity: e.quantity,
      name: e.name,
      priceCents: e.price_cents,
      durationMin: e.duration_min,
    })),
  };
}

export type MobileAppointment = ReturnType<typeof serializeMobileAppointment>;
