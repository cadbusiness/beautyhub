"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";
import {
  fetchPublicServiceExtras,
  fetchPublicServices,
  fetchPublicSlots,
  fetchPublicStaff,
  publicBookingExtrasPayload,
  type PublicService,
  type PublicSlot,
  type PublicStaff,
} from "@/lib/public/booking-load";

export async function loadPublicServices(): Promise<PublicService[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  return fetchPublicServices(supabase, tenant.id);
}

export async function loadPublicServiceExtras(serviceId: string): Promise<ServiceExtraConfig[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  return fetchPublicServiceExtras(supabase, tenant.id, serviceId);
}

export async function loadPublicStaff(serviceId: string): Promise<PublicStaff[]> {
  const tenant = await getTenantContext();
  if (!tenant) return [];
  const supabase = await createClient();
  return fetchPublicStaff(supabase, tenant.id, serviceId);
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
  return fetchPublicSlots(supabase, tenant.id, serviceId, date, staffId, extras);
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
    p_extras: publicBookingExtrasPayload(input.extras ?? []),
  });

  if (error) return { error: error.message };
  return { ok: true, appointmentId: data as string };
}
