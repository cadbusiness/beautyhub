"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { normalizePromoCode } from "@/lib/institut/promos-core";

const PROMOS_PATH = "/institut/marketing/promos";

export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function parseOptionalDate(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseOptionalPositiveInt(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function savePromo(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.promos.actions");

  const id = String(formData.get("id") ?? "").trim();
  const code = normalizePromoCode(String(formData.get("code") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const discountType = String(formData.get("discount_type") ?? "").trim();
  const isActive = formData.get("is_active") === "1";
  const channelWoo = formData.get("channel_woo") === "1";
  const channelBooking = formData.get("channel_booking") === "1";
  const channelPos = formData.get("channel_pos") === "1";

  if (!code || !name) return { error: t("missingFields") };
  if (discountType !== "percent" && discountType !== "fixed") {
    return { error: t("invalidDiscount") };
  }
  if (!channelWoo && !channelBooking && !channelPos) {
    return { error: t("channelRequired") };
  }

  let discountPercent: number | null = null;
  let discountCents: number | null = null;

  if (discountType === "percent") {
    const pct = Math.round(Number(formData.get("discount_percent") ?? 0));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return { error: t("invalidPercent") };
    }
    discountPercent = pct;
  } else {
    const euros = Number(String(formData.get("discount_euros") ?? "").replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) return { error: t("invalidFixed") };
    discountCents = Math.round(euros * 100);
  }

  const minOrderEuros = Number(String(formData.get("min_order_euros") ?? "0").replace(",", "."));
  const minOrderCents =
    Number.isFinite(minOrderEuros) && minOrderEuros > 0 ? Math.round(minOrderEuros * 100) : 0;

  const startsAt = parseOptionalDate(formData.get("starts_at"));
  const endsAt = parseOptionalDate(formData.get("ends_at"));
  if (startsAt && endsAt && startsAt > endsAt) {
    return { error: t("invalidPeriod") };
  }

  const payload = {
    code,
    name,
    description,
    discount_type: discountType,
    discount_percent: discountPercent,
    discount_cents: discountCents,
    min_order_cents: minOrderCents,
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: parseOptionalPositiveInt(formData.get("usage_limit")),
    usage_limit_per_client: parseOptionalPositiveInt(formData.get("usage_limit_per_client")),
    channel_woo: channelWoo,
    channel_booking: channelBooking,
    channel_pos: channelPos,
    is_active: isActive,
  };

  if (id) {
    const { error } = await supabase
      .from("inst_promos")
      .update(payload)
      .eq("tenant_id", session.tenant.id)
      .eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: t("codeExists") };
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("inst_promos").insert({
      tenant_id: session.tenant.id,
      ...payload,
    });
    if (error) {
      if (error.code === "23505") return { error: t("codeExists") };
      return { error: error.message };
    }
  }

  revalidatePath(PROMOS_PATH);
  return { ok: true, message: t("saved") };
}

export async function deletePromo(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("inst_promos")
    .delete()
    .eq("tenant_id", session.tenant.id)
    .eq("id", id);

  revalidatePath(PROMOS_PATH);
}
