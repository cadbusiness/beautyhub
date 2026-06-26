"use server";

import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  color: string | null;
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

export async function loadPublicServices(): Promise<PublicService[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_services", {
    p_tenant_id: tenant.id,
  });
  return (data ?? []) as PublicService[];
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
): Promise<PublicSlot[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_available_slots", {
    p_tenant_id: tenant.id,
    p_service_id: serviceId,
    p_date: date,
    p_staff_id: staffId ?? undefined,
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
}): Promise<BookResult> {
  const tenant = await getTenantContext();
  if (!tenant) return { error: "Institut introuvable." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_public_appointment", {
    p_tenant_id: tenant.id,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId,
    p_starts_at: input.startsAt,
    p_email: input.email,
    p_full_name: input.fullName,
    p_phone: input.phone ?? undefined,
  });

  if (error) return { error: error.message };
  return { ok: true, appointmentId: data as string };
}
