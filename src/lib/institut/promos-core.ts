import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type PromoChannel = "woo" | "booking" | "pos";
export type PromoDiscountType = "percent" | "fixed";
export type PromoStatus = "active" | "inactive" | "scheduled" | "expired" | "exhausted";

export type PromoRow = Database["public"]["Tables"]["inst_promos"]["Row"];

export interface ValidatePromoInput {
  code: string;
  channel: PromoChannel;
  subtotalCents: number;
  clientId?: string | null;
}

export interface ValidatePromoResult {
  valid: boolean;
  error?: string;
  promo?: PromoRow;
  discount_cents: number;
}

export interface RedeemPromoInput {
  code: string;
  channel: PromoChannel;
  amountCents: number;
  clientId?: string | null;
  saleId?: string | null;
  appointmentId?: string | null;
  wooOrderId?: number | null;
  idempotencyKey?: string | null;
  metadata?: Json;
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export function computePromoDiscountCents(
  promo: Pick<PromoRow, "discount_type" | "discount_percent" | "discount_cents">,
  subtotalCents: number,
): number {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal <= 0) return 0;
  if (promo.discount_type === "percent" && promo.discount_percent) {
    return Math.min(subtotal, Math.round((subtotal * promo.discount_percent) / 100));
  }
  if (promo.discount_type === "fixed" && promo.discount_cents) {
    return Math.min(subtotal, promo.discount_cents);
  }
  return 0;
}

export function resolvePromoStatus(promo: PromoRow, now = new Date()): PromoStatus {
  if (!promo.is_active) return "inactive";
  if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) {
    return "exhausted";
  }
  if (promo.starts_at && new Date(promo.starts_at) > now) return "scheduled";
  if (promo.ends_at && new Date(promo.ends_at) < now) return "expired";
  return "active";
}

function channelEnabled(promo: PromoRow, channel: PromoChannel): boolean {
  if (channel === "woo") return promo.channel_woo;
  if (channel === "booking") return promo.channel_booking;
  return promo.channel_pos;
}

export async function getPromoByCode(
  supabase: Db,
  tenantId: string,
  code: string,
): Promise<PromoRow | null> {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;
  const { data } = await supabase
    .from("inst_promos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", normalized)
    .maybeSingle();
  return data;
}

export async function listPromos(
  supabase: Db,
  tenantId: string,
  opts?: { search?: string; limit?: number },
): Promise<PromoRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 100));
  let query = supabase
    .from("inst_promos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const search = opts?.search?.trim();
  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function countClientRedemptions(
  supabase: Db,
  tenantId: string,
  promoId: string,
  clientId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("inst_promo_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("promo_id", promoId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function validatePromo(
  supabase: Db,
  tenantId: string,
  input: ValidatePromoInput,
): Promise<ValidatePromoResult> {
  const code = normalizePromoCode(input.code);
  if (!code) {
    return { valid: false, error: "promo_code_required", discount_cents: 0 };
  }

  const promo = await getPromoByCode(supabase, tenantId, code);
  if (!promo) {
    return { valid: false, error: "promo_not_found", discount_cents: 0 };
  }

  const status = resolvePromoStatus(promo);
  if (status === "inactive") {
    return { valid: false, error: "promo_inactive", promo, discount_cents: 0 };
  }
  if (status === "scheduled") {
    return { valid: false, error: "promo_not_started", promo, discount_cents: 0 };
  }
  if (status === "expired") {
    return { valid: false, error: "promo_expired", promo, discount_cents: 0 };
  }
  if (status === "exhausted") {
    return { valid: false, error: "promo_exhausted", promo, discount_cents: 0 };
  }

  if (!channelEnabled(promo, input.channel)) {
    return { valid: false, error: "promo_channel_disabled", promo, discount_cents: 0 };
  }

  const subtotal = Math.max(0, Math.round(input.subtotalCents));
  if (subtotal < promo.min_order_cents) {
    return { valid: false, error: "promo_min_order", promo, discount_cents: 0 };
  }

  if (input.clientId && promo.usage_limit_per_client != null) {
    const uses = await countClientRedemptions(
      supabase,
      tenantId,
      promo.id,
      input.clientId,
    );
    if (uses >= promo.usage_limit_per_client) {
      return { valid: false, error: "promo_client_limit", promo, discount_cents: 0 };
    }
  }

  const discountCents = computePromoDiscountCents(promo, subtotal);
  if (discountCents <= 0) {
    return { valid: false, error: "promo_no_discount", promo, discount_cents: 0 };
  }

  return { valid: true, promo, discount_cents: discountCents };
}

export async function redeemPromo(
  supabase: Db,
  tenantId: string,
  input: RedeemPromoInput,
): Promise<{
  redemptionId: string;
  promoId: string;
  code: string;
  amountCents: number;
  usageCount: number;
}> {
  const code = normalizePromoCode(input.code);
  if (!code) throw new Error("promo_code_required");
  if (input.amountCents <= 0) throw new Error("invalid_amount");

  const { data, error } = await supabase.rpc("inst_redeem_promo", {
    p_tenant_id: tenantId,
    p_code: code,
    p_channel: input.channel,
    p_amount_cents: input.amountCents,
    p_client_id: input.clientId ?? undefined,
    p_sale_id: input.saleId ?? undefined,
    p_appointment_id: input.appointmentId ?? undefined,
    p_woo_order_id: input.wooOrderId ?? undefined,
    p_idempotency_key: input.idempotencyKey?.trim() || undefined,
    p_metadata: input.metadata ?? {},
  });
  if (error || !data?.[0]) throw new Error(error?.message ?? "promo_redeem_failed");

  return {
    redemptionId: data[0].redemption_id,
    promoId: data[0].promo_id,
    code: data[0].code,
    amountCents: data[0].amount_cents,
    usageCount: data[0].usage_count,
  };
}
