import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { normalizePromoCode, type PromoDiscountType } from "./promos-core";

type Db = SupabaseClient<Database>;

export class PromoAdminError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PromoAdminError";
  }
}

export type PromoWriteInput = {
  id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  discountType: PromoDiscountType | string;
  discountPercent?: number | null;
  discountCents?: number | null;
  minOrderCents?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageLimitPerClient?: number | null;
  channelWoo: boolean;
  channelBooking: boolean;
  channelPos: boolean;
  isActive: boolean;
};

function optionalPositiveInt(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Math.round(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function savePromoRecord(
  supabase: Db,
  tenantId: string,
  input: PromoWriteInput,
): Promise<{ promoId: string }> {
  const code = normalizePromoCode(input.code);
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const discountType = input.discountType;

  if (!code || !name) throw new PromoAdminError("missing_fields");
  if (discountType !== "percent" && discountType !== "fixed") {
    throw new PromoAdminError("invalid_discount");
  }
  if (!input.channelWoo && !input.channelBooking && !input.channelPos) {
    throw new PromoAdminError("channel_required");
  }

  let discountPercent: number | null = null;
  let discountCents: number | null = null;
  if (discountType === "percent") {
    const pct = Math.round(input.discountPercent ?? 0);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new PromoAdminError("invalid_percent");
    }
    discountPercent = pct;
  } else {
    const cents = Math.round(input.discountCents ?? 0);
    if (!Number.isFinite(cents) || cents <= 0) {
      throw new PromoAdminError("invalid_fixed");
    }
    discountCents = cents;
  }

  const startsAt = input.startsAt?.trim() || null;
  const endsAt = input.endsAt?.trim() || null;
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new PromoAdminError("invalid_period");
  }

  const payload = {
    code,
    name,
    description,
    discount_type: discountType,
    discount_percent: discountPercent,
    discount_cents: discountCents,
    min_order_cents: Math.max(0, Math.round(input.minOrderCents ?? 0)),
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: optionalPositiveInt(input.usageLimit),
    usage_limit_per_client: optionalPositiveInt(input.usageLimitPerClient),
    channel_woo: input.channelWoo,
    channel_booking: input.channelBooking,
    channel_pos: input.channelPos,
    is_active: input.isActive,
  };

  const id = input.id?.trim() || null;
  if (id) {
    const { error } = await supabase
      .from("inst_promos")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", id);
    if (error) {
      if (error.code === "23505") throw new PromoAdminError("code_exists");
      throw new Error(error.message);
    }
    return { promoId: id };
  }

  const { data, error } = await supabase
    .from("inst_promos")
    .insert({ tenant_id: tenantId, ...payload })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new PromoAdminError("code_exists");
    throw new Error(error.message);
  }
  return { promoId: data.id };
}

export async function deletePromoRecord(
  supabase: Db,
  tenantId: string,
  promoId: string,
): Promise<void> {
  const id = promoId.trim();
  if (!id) throw new PromoAdminError("missing_fields");
  const { error } = await supabase
    .from("inst_promos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function promoAdminHttp(error: unknown): Response {
  if (error instanceof PromoAdminError) {
    const messages: Record<string, string> = {
      missing_fields: "Code et nom requis.",
      invalid_discount: "Type de remise invalide.",
      channel_required: "Choisissez au moins un canal.",
      invalid_percent: "Pourcentage invalide.",
      invalid_fixed: "Montant invalide.",
      invalid_period: "La date de fin doit être après le début.",
      code_exists: "Ce code existe déjà.",
    };
    return Response.json(
      { error: error.code, message: messages[error.code] ?? error.code },
      { status: 400 },
    );
  }
  return Response.json(
    {
      error: "promo_failed",
      message: error instanceof Error ? error.message : "promo_failed",
    },
    { status: 500 },
  );
}
