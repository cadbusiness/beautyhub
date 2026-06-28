"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";
import type { Json } from "@/lib/db/database.types";

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  color: string | null;
  extras_step_position: string;
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

export async function loadPublicServices(): Promise<PublicService[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_services", {
    p_tenant_id: tenant.id,
  });
  return (data ?? []) as PublicService[];
}

export async function loadPublicServiceExtras(serviceId: string): Promise<ServiceExtraConfig[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_service_extras", {
    p_tenant_id: tenant.id,
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

export async function loadPublicStaff(serviceId: string): Promise<PublicStaff[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_staff_for_service", {
    p_tenant_id: tenant.id,
    p_service_id: serviceId,
  });
  return (data ?? []) as PublicStaff[];
}

export async function loadPublicSlots(
  serviceId: string,
  date: string,
  staffId?: string,
  extras: BookingExtraLine[] = [],
): Promise<PublicSlot[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_available_slots", {
    p_tenant_id: tenant.id,
    p_service_id: serviceId,
    p_date: date,
    p_staff_id: staffId ?? undefined,
    p_extras: extrasPayload(extras),
  });
  return (data ?? []) as PublicSlot[];
}

export interface BookResult {
  error?: string;
  ok?: boolean;
  appointmentId?: string;
}

export async function bookPublicAppointment(input: {
  serviceId: string;
  staffId: string;
  startsAt: string;
  email: string;
  fullName: string;
  phone?: string;
  extras?: BookingExtraLine[];
}): Promise<BookResult> {
  const actions = await getTranslations("institut.actions");
  const tenant = await getTenantContext();
  if (!tenant) return { error: actions("tenantNotFound") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_public_appointment", {
    p_tenant_id: tenant.id,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId,
    p_starts_at: input.startsAt,
    p_email: input.email,
    p_full_name: input.fullName,
    p_phone: input.phone ?? undefined,
    p_extras: extrasPayload(input.extras ?? []),
  });

  if (error) return { error: error.message };
  return { ok: true, appointmentId: data as string };
}
