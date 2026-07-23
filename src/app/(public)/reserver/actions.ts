"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/tenant/context";
import { processSameDayRebookOnNewAppointment } from "@/lib/institut/loyalty-events";
import {
  normalizePromoCode,
  redeemPromo,
  validatePromo,
} from "@/lib/institut/promos-core";
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

export interface QuoteRequestResult {
  error?: string;
  ok?: boolean;
}

export async function submitPublicQuoteRequest(input: {
  serviceId: string;
  email: string;
  fullName: string;
  phone?: string;
  message?: string;
  eventDate?: string;
}): Promise<QuoteRequestResult> {
  const actions = await getTranslations("institut.actions");
  const tenant = await getTenantContext();
  if (!tenant) return { error: actions("tenantNotFound") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_public_quote_request", {
    p_tenant_id: tenant.id,
    p_service_id: input.serviceId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_phone: input.phone ?? undefined,
    p_message: input.message ?? undefined,
    p_event_date: input.eventDate ?? undefined,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function bookPublicAppointment(input: {
  serviceId: string;
  staffId: string;
  startsAt: string;
  email: string;
  fullName: string;
  phone?: string;
  extras?: BookingExtraLine[];
  promoCode?: string;
}): Promise<BookResult> {
  const actions = await getTranslations("institut.actions");
  const tenant = await getTenantContext();
  if (!tenant) return { error: actions("tenantNotFound") };

  const supabase = await createClient();
  const service = createServiceClient();
  const promoCode = normalizePromoCode(input.promoCode ?? "");

  if (promoCode) {
    const { data: priceCents, error: priceError } = await service.rpc(
      "inst_booking_price_cents",
      {
        p_service_id: input.serviceId,
        p_extras: publicBookingExtrasPayload(input.extras ?? []),
      },
    );
    if (priceError || priceCents == null) {
      return { error: priceError?.message ?? actions("invalidAmount") };
    }
    const validated = await validatePromo(service, tenant.id, {
      code: promoCode,
      channel: "booking",
      subtotalCents: Number(priceCents),
    });
    if (!validated.valid) {
      const key = validated.error ?? "promoInvalid";
      const map: Record<string, string> = {
        promo_code_required: "promoCodeRequired",
        promo_not_found: "promoNotFound",
        promo_inactive: "promoInactive",
        promo_not_started: "promoNotStarted",
        promo_expired: "promoExpired",
        promo_exhausted: "promoExhausted",
        promo_channel_disabled: "promoChannelDisabled",
        promo_min_order: "promoMinOrder",
        promo_client_limit: "promoClientLimit",
        promo_no_discount: "promoNoDiscount",
      };
      const tKey = map[key];
      return { error: tKey ? actions(tKey as "promoInvalid") : key };
    }
  }

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

  const appointmentId = data as string;
  const { data: appt } = await service
    .from("inst_appointments")
    .select("client_id, price_cents")
    .eq("id", appointmentId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (promoCode && appt) {
    const validated = await validatePromo(service, tenant.id, {
      code: promoCode,
      channel: "booking",
      subtotalCents: appt.price_cents ?? 0,
      clientId: appt.client_id,
    });
    if (validated.valid && validated.promo && validated.discount_cents > 0) {
      const netPrice = Math.max(0, (appt.price_cents ?? 0) - validated.discount_cents);
      await service
        .from("inst_appointments")
        .update({
          promo_id: validated.promo.id,
          promo_discount_cents: validated.discount_cents,
          price_cents: netPrice,
        })
        .eq("id", appointmentId)
        .eq("tenant_id", tenant.id);

      try {
        await redeemPromo(service, tenant.id, {
          code: promoCode,
          channel: "booking",
          amountCents: validated.discount_cents,
          clientId: appt.client_id,
          appointmentId,
          idempotencyKey: `booking:appt:${appointmentId}:promo:${promoCode}`,
        });
      } catch (redeemError) {
        console.error("[bookPublicAppointment] promo redeem failed", redeemError);
      }
    }
  }

  if (appt?.client_id) {
    await processSameDayRebookOnNewAppointment(
      supabase,
      tenant.id,
      appt.client_id,
      appointmentId,
    );
  }

  return { ok: true, appointmentId };
}
