import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";

type Db = SupabaseClient<Database>;

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  color: string | null;
  extras_step_position: string;
  image_url: string | null;
  booking_mode: string;
}

export interface PublicStaff {
  id: string;
  full_name: string;
  color: string | null;
}

export interface PublicSlot {
  starts_at: string;
  ends_at: string;
  staff_id: string;
}

function extrasPayload(extras: BookingExtraLine[]): Json {
  return extras.map((e) => ({ service_id: e.service_id, quantity: e.quantity })) as Json;
}

export function publicBookingExtrasPayload(extras: BookingExtraLine[]): Json {
  return extrasPayload(extras);
}

export async function fetchPublicServices(
  supabase: Db,
  tenantId: string,
): Promise<PublicService[]> {
  const { data } = await supabase.rpc("get_public_services", { p_tenant_id: tenantId });
  return (data ?? []) as PublicService[];
}

export async function fetchPublicServiceExtras(
  supabase: Db,
  tenantId: string,
  serviceId: string,
): Promise<ServiceExtraConfig[]> {
  const { data } = await supabase.rpc("get_public_service_extras", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
  });
  return (data ?? []).map((row) => ({
    extra_service_id: row.extra_service_id,
    name: row.name,
    description: row.description,
    duration_min: row.duration_min,
    price_cents: row.price_cents,
    image_url: row.image_url,
    min_qty: row.min_qty,
    max_qty: row.max_qty,
    sort_order: row.sort_order,
  }));
}

export async function fetchPublicStaff(
  supabase: Db,
  tenantId: string,
  serviceId: string,
): Promise<PublicStaff[]> {
  const { data } = await supabase.rpc("get_public_staff_for_service", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
  });
  return (data ?? []) as PublicStaff[];
}

export async function fetchPublicSlots(
  supabase: Db,
  tenantId: string,
  serviceId: string,
  date: string,
  staffId?: string,
  extras: BookingExtraLine[] = [],
): Promise<PublicSlot[]> {
  const { data } = await supabase.rpc("get_public_available_slots", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_date: date,
    p_staff_id: staffId ?? undefined,
    p_extras: extrasPayload(extras),
  });
  return (data ?? []) as PublicSlot[];
}
