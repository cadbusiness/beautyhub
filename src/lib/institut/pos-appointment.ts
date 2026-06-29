export interface PosAppointmentOption {
  id: string;
  label: string;
  clientId?: string;
  staffId?: string;
  serviceId?: string;
  extras: { service_id: string; quantity: number; name: string }[];
  prefillCart: Record<string, number>;
}

type AppointmentRow = {
  id: string;
  client_id: string | null;
  staff_id: string | null;
  service_id: string | null;
  starts_at: string;
  clients: { full_name: string | null; email: string } | null;
  inst_services: { name: string } | null;
  extras?: { service_id: string; quantity: number; name: string }[] | null;
};

export function buildPosAppointmentOption(a: AppointmentRow): PosAppointmentOption {
  const client = a.clients;
  const service = a.inst_services;
  const extras = (a.extras ?? []) as { service_id: string; quantity: number; name: string }[];
  const time = new Date(a.starts_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const extrasLabel =
    extras.length > 0
      ? ` (+ ${extras.map((e) => (e.quantity > 1 ? `${e.quantity}× ` : "") + e.name).join(", ")})`
      : "";
  const prefillCart: Record<string, number> = {};
  if (a.service_id) prefillCart[`service:${a.service_id}`] = 1;
  for (const ex of extras) {
    const key = `service:${ex.service_id}`;
    prefillCart[key] = (prefillCart[key] ?? 0) + ex.quantity;
  }
  return {
    id: a.id,
    clientId: a.client_id ?? undefined,
    staffId: a.staff_id ?? undefined,
    serviceId: a.service_id ?? undefined,
    extras,
    prefillCart,
    label: `${time} · ${service?.name ?? "?"}${extrasLabel} · ${client?.full_name ?? client?.email ?? "—"}`,
  };
}

export function applyPosAppointmentPrefill(
  appt: PosAppointmentOption,
): {
  cart: Record<string, number>;
  clientId: string;
  staffId: string;
  appointmentId: string;
} {
  return {
    cart: { ...appt.prefillCart },
    clientId: appt.clientId ?? "",
    staffId: appt.staffId ?? "",
    appointmentId: appt.id,
  };
}
