/** Ligne extra selectionnee sur un rendez-vous ou dans le panier de reservation. */
export interface BookingExtraLine {
  service_id: string;
  quantity: number;
}

export interface ServiceExtraConfig {
  extra_service_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  image_url: string | null;
  min_qty: number;
  max_qty: number;
  sort_order: number;
}

export interface AppointmentExtraSnapshot {
  id: string;
  service_id: string;
  quantity: number;
  price_cents: number;
  duration_min: number;
  name: string;
}

/** Somme duree prestation principale + extras. */
export function totalDurationMin(
  baseDurationMin: number,
  extras: BookingExtraLine[],
  extraCatalog: ServiceExtraConfig[],
): number {
  let total = baseDurationMin;
  for (const line of extras) {
    if (line.quantity <= 0) continue;
    const cfg = extraCatalog.find((e) => e.extra_service_id === line.service_id);
    if (cfg) total += cfg.duration_min * line.quantity;
  }
  return total;
}

/** Somme prix prestation principale + extras. */
export function totalPriceCents(
  basePriceCents: number,
  extras: BookingExtraLine[],
  extraCatalog: ServiceExtraConfig[],
): number {
  let total = basePriceCents;
  for (const line of extras) {
    if (line.quantity <= 0) continue;
    const cfg = extraCatalog.find((e) => e.extra_service_id === line.service_id);
    if (cfg) total += cfg.price_cents * line.quantity;
  }
  return total;
}

export function parseExtrasJson(raw: string | null | undefined): BookingExtraLine[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        service_id: String((item as BookingExtraLine).service_id ?? ""),
        quantity: Number((item as BookingExtraLine).quantity ?? 0),
      }))
      .filter((l) => l.service_id && l.quantity > 0);
  } catch {
    return [];
  }
}

export function extrasToJson(extras: BookingExtraLine[]): string {
  return JSON.stringify(extras.filter((e) => e.quantity > 0));
}
