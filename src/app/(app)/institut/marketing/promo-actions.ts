"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PromoAdminError, deletePromoRecord, savePromoRecord } from "@/lib/institut/promos-admin";

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

function mapAdminError(
  code: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  switch (code) {
    case "missing_fields":
      return t("missingFields");
    case "invalid_discount":
      return t("invalidDiscount");
    case "channel_required":
      return t("channelRequired");
    case "invalid_percent":
      return t("invalidPercent");
    case "invalid_fixed":
      return t("invalidFixed");
    case "invalid_period":
      return t("invalidPeriod");
    case "code_exists":
      return t("codeExists");
    default:
      return code;
  }
}

export async function savePromo(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("institut.marketing.promos.actions");

  const discountType = String(formData.get("discount_type") ?? "").trim();
  let discountCents: number | null = null;
  if (discountType === "fixed") {
    const euros = Number(String(formData.get("discount_euros") ?? "").replace(",", "."));
    discountCents = Number.isFinite(euros) ? Math.round(euros * 100) : 0;
  }

  const minOrderEuros = Number(String(formData.get("min_order_euros") ?? "0").replace(",", "."));
  const minOrderCents =
    Number.isFinite(minOrderEuros) && minOrderEuros > 0 ? Math.round(minOrderEuros * 100) : 0;

  try {
    await savePromoRecord(supabase, session.tenant.id, {
      id: String(formData.get("id") ?? "").trim() || null,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      discountType,
      discountPercent: Number(formData.get("discount_percent") ?? 0),
      discountCents,
      minOrderCents,
      startsAt: parseOptionalDate(formData.get("starts_at")),
      endsAt: parseOptionalDate(formData.get("ends_at")),
      usageLimit: parseOptionalPositiveInt(formData.get("usage_limit")),
      usageLimitPerClient: parseOptionalPositiveInt(formData.get("usage_limit_per_client")),
      channelWoo: formData.get("channel_woo") === "1",
      channelBooking: formData.get("channel_booking") === "1",
      channelPos: formData.get("channel_pos") === "1",
      isActive: formData.get("is_active") === "1",
    });
  } catch (e) {
    if (e instanceof PromoAdminError) return { error: mapAdminError(e.code, t) };
    return { error: (e as Error).message };
  }

  revalidatePath(PROMOS_PATH);
  return { ok: true, message: t("saved") };
}

export async function deletePromo(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deletePromoRecord(supabase, session.tenant.id, id);
  revalidatePath(PROMOS_PATH);
}
