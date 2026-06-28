import type { Json } from "@/lib/db/database.types";

export interface BookingFlowConfig {
  showStaffPicker: boolean;
  requireStaff: boolean;
  showExtrasStep: boolean;
  requirePhone: boolean;
  /** null = toutes les prestations du catalogue public */
  allowedServiceIds: string[] | null;
}

export interface BookingFlowRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_published: boolean;
  config: BookingFlowConfig;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BOOKING_FLOW_CONFIG: BookingFlowConfig = {
  showStaffPicker: true,
  requireStaff: false,
  showExtrasStep: true,
  requirePhone: false,
  allowedServiceIds: null,
};

export function parseBookingFlowConfig(raw: unknown): BookingFlowConfig {
  const o =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const allowed = o.allowedServiceIds;
  return {
    showStaffPicker: o.showStaffPicker !== false,
    requireStaff: o.requireStaff === true,
    showExtrasStep: o.showExtrasStep !== false,
    requirePhone: o.requirePhone === true,
    allowedServiceIds:
      allowed === null || allowed === undefined
        ? null
        : Array.isArray(allowed)
          ? allowed.filter((id): id is string => typeof id === "string")
          : null,
  };
}

export function bookingFlowConfigToJson(config: BookingFlowConfig): Json {
  return {
    showStaffPicker: config.showStaffPicker,
    requireStaff: config.requireStaff,
    showExtrasStep: config.showExtrasStep,
    requirePhone: config.requirePhone,
    allowedServiceIds: config.allowedServiceIds,
  } as Json;
}

export function normalizeBookingFlowSlug(raw: string, isDefault: boolean): string {
  if (isDefault) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Chemin public (/reserver ou /reserver/{slug}). */
export function bookingFlowPublicPath(slug: string): string {
  const s = slug.trim();
  return s ? `/reserver/${s}` : "/reserver";
}

/** Chemin embed minimal (iframe). */
export function bookingFlowEmbedPath(slug: string): string {
  const s = slug.trim();
  return s ? `/embed/reserver/${s}` : "/embed/reserver";
}

export function bookingFlowPublicUrl(baseUrl: string, slug: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${bookingFlowPublicPath(slug)}`;
}

export function bookingFlowEmbedUrl(baseUrl: string, slug: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${bookingFlowEmbedPath(slug)}`;
}

export function bookingFlowEmbedHtml(embedUrl: string, title = "Réservation"): string {
  return `<iframe src="${embedUrl}" width="100%" height="720" style="border:0;border-radius:8px;" title="${title}" loading="lazy"></iframe>`;
}

export function mapBookingFlowRow(row: {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_published: boolean;
  config: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): BookingFlowRow {
  return {
    ...row,
    config: parseBookingFlowConfig(row.config),
  };
}
