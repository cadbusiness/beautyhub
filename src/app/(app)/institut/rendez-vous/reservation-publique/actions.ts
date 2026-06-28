"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getTenantPublicBaseUrl } from "@/lib/tenant/public-site";
import {
  bookingFlowConfigToJson,
  mapBookingFlowRow,
  normalizeBookingFlowSlug,
  type BookingFlowConfig,
  type BookingFlowRow,
} from "@/lib/institut/booking-flows";

export type ActionResult = { ok?: boolean; error?: string; id?: string };

const ADMIN_PATH = "/institut/rendez-vous/reservation-publique";

function revalidateBookingAdmin() {
  revalidatePath(ADMIN_PATH);
  revalidatePath("/institut/rendez-vous");
  revalidatePath("/reserver");
}

function parseConfigFromForm(formData: FormData): BookingFlowConfig {
  const allowedIds = formData
    .getAll("allowed_service_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  return {
    showStaffPicker: formData.get("show_staff_picker") === "on",
    requireStaff: formData.get("require_staff") === "on",
    showExtrasStep: formData.get("show_extras_step") === "on",
    requirePhone: formData.get("require_phone") === "on",
    allowedServiceIds: allowedIds.length > 0 ? allowedIds : null,
  };
}

export async function loadBookingFlowsAdmin(): Promise<{
  flows: BookingFlowRow[];
  publicBaseUrl: string;
}> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inst_booking_flows")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .order("sort_order")
    .order("created_at");

  if (error) throw error;

  const publicBaseUrl = await getTenantPublicBaseUrl(session.tenant.slug, session.tenant);

  return {
    flows: (data ?? []).map(mapBookingFlowRow),
    publicBaseUrl,
  };
}

export async function saveBookingFlow(formData: FormData): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const isDefault = formData.get("is_default") === "on";
  const isPublished = formData.get("is_published") === "on";
  const slug = normalizeBookingFlowSlug(String(formData.get("slug") ?? ""), isDefault);
  const config = parseConfigFromForm(formData);

  if (!name) return { error: "name_required" };

  if (isDefault) {
    await supabase
      .from("inst_booking_flows")
      .update({ is_default: false })
      .eq("tenant_id", session.tenant.id)
      .neq("id", id || "00000000-0000-0000-0000-000000000000");
  }

  const payload = {
    tenant_id: session.tenant.id,
    name,
    slug,
    is_default: isDefault,
    is_published: isPublished,
    config: bookingFlowConfigToJson(config),
  };

  if (id) {
    const { error } = await supabase
      .from("inst_booking_flows")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", session.tenant.id);
    if (error) return { error: error.message };
    revalidateBookingAdmin();
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("inst_booking_flows")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateBookingAdmin();
  return { ok: true, id: data.id };
}

export async function deleteBookingFlow(formData: FormData): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "id_required" };

  const { data: row } = await supabase
    .from("inst_booking_flows")
    .select("is_default")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (row?.is_default) return { error: "cannot_delete_default" };

  const { error } = await supabase
    .from("inst_booking_flows")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidateBookingAdmin();
  return { ok: true };
}

export async function setDefaultBookingFlow(formData: FormData): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "id_required" };

  await supabase
    .from("inst_booking_flows")
    .update({ is_default: false })
    .eq("tenant_id", session.tenant.id);

  const { error } = await supabase
    .from("inst_booking_flows")
    .update({ is_default: true, slug: "" })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: error.message };
  revalidateBookingAdmin();
  return { ok: true };
}
