import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type VoucherType = "gift_card" | "credit_note" | "voucher";
export type VoucherSource = "pos" | "woo" | "legacy" | "admin" | "api";

export interface IssueVoucherInput {
  code: string;
  voucherType: VoucherType;
  sourceChannel: VoucherSource;
  amountCents: number;
  currency?: string;
  recipientName?: string | null;
  clientId?: string | null;
  expiresAt?: string | null;
  metadata?: Json;
  saleId?: string | null;
  wooOrderId?: number | null;
  wooCouponCode?: string | null;
  idempotencyKey?: string | null;
}

export interface RedeemVoucherInput {
  code: string;
  amountCents: number;
  sourceChannel: VoucherSource;
  saleId?: string | null;
  wooOrderId?: number | null;
  wooCouponCode?: string | null;
  idempotencyKey?: string | null;
  metadata?: Json;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function issueVoucher(
  supabase: Db,
  tenantId: string,
  input: IssueVoucherInput,
): Promise<{ id: string; code: string; current_balance_cents: number }> {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("voucher_code_required");
  if (input.amountCents <= 0) throw new Error("invalid_amount");

  if (input.idempotencyKey?.trim()) {
    const { data: existingEvent } = await supabase
      .from("inst_voucher_events")
      .select("voucher_id")
      .eq("tenant_id", tenantId)
      .eq("event_type", "issue")
      .eq("idempotency_key", input.idempotencyKey.trim())
      .maybeSingle();
    if (existingEvent?.voucher_id) {
      const { data: voucher } = await supabase
        .from("inst_vouchers")
        .select("id, code, current_balance_cents")
        .eq("tenant_id", tenantId)
        .eq("id", existingEvent.voucher_id)
        .maybeSingle();
      if (voucher) return voucher;
    }
  }

  const { data: voucher, error: voucherError } = await supabase
    .from("inst_vouchers")
    .insert({
      tenant_id: tenantId,
      code,
      voucher_type: input.voucherType,
      source_channel: input.sourceChannel,
      currency: (input.currency ?? "eur").toLowerCase(),
      initial_amount_cents: input.amountCents,
      current_balance_cents: input.amountCents,
      status: "active",
      recipient_name: input.recipientName ?? null,
      client_id: input.clientId ?? null,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id, code, current_balance_cents")
    .single();
  if (voucherError || !voucher) throw new Error(voucherError?.message ?? "voucher_issue_failed");

  const { error: eventError } = await supabase.from("inst_voucher_events").insert({
    tenant_id: tenantId,
    voucher_id: voucher.id,
    event_type: "issue",
    amount_cents: input.amountCents,
    balance_after_cents: input.amountCents,
    source_channel: input.sourceChannel,
    sale_id: input.saleId ?? null,
    woo_order_id: input.wooOrderId ?? null,
    woo_coupon_code: input.wooCouponCode ?? null,
    idempotency_key: input.idempotencyKey?.trim() || null,
    metadata: input.metadata ?? {},
  });
  if (eventError) throw new Error(eventError.message);

  if (input.saleId || input.wooOrderId || input.wooCouponCode) {
    const { error: linkError } = await supabase.from("inst_voucher_links").insert({
      tenant_id: tenantId,
      voucher_id: voucher.id,
      sale_id: input.saleId ?? null,
      woo_order_id: input.wooOrderId ?? null,
      woo_coupon_code: input.wooCouponCode ?? null,
    });
    if (linkError) throw new Error(linkError.message);
  }

  return voucher;
}

export async function redeemVoucher(
  supabase: Db,
  tenantId: string,
  input: RedeemVoucherInput,
): Promise<{ voucherId: string; code: string; remainingCents: number; status: string; eventId: string }> {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("voucher_code_required");
  if (input.amountCents <= 0) throw new Error("invalid_amount");

  const { data, error } = await supabase.rpc("inst_redeem_voucher", {
    p_tenant_id: tenantId,
    p_code: code,
    p_amount_cents: input.amountCents,
    p_source_channel: input.sourceChannel,
    p_sale_id: input.saleId ?? undefined,
    p_woo_order_id: input.wooOrderId ?? undefined,
    p_woo_coupon_code: input.wooCouponCode ?? undefined,
    p_idempotency_key: input.idempotencyKey?.trim() || undefined,
    p_metadata: input.metadata ?? {},
  });
  if (error || !data?.[0]) throw new Error(error?.message ?? "voucher_redeem_failed");

  return {
    voucherId: data[0].voucher_id,
    code: data[0].code,
    remainingCents: data[0].remaining_cents,
    status: data[0].status,
    eventId: data[0].event_id,
  };
}

export async function voidVoucher(
  supabase: Db,
  tenantId: string,
  voucherId: string,
  input?: { sourceChannel?: VoucherSource; metadata?: Json; idempotencyKey?: string | null },
): Promise<void> {
  const { data: voucher, error: voucherError } = await supabase
    .from("inst_vouchers")
    .select("id, current_balance_cents, status")
    .eq("tenant_id", tenantId)
    .eq("id", voucherId)
    .maybeSingle();
  if (voucherError) throw new Error(voucherError.message);
  if (!voucher) throw new Error("voucher_not_found");
  if (voucher.status === "cancelled") return;

  const { error } = await supabase
    .from("inst_vouchers")
    .update({ status: "cancelled" })
    .eq("tenant_id", tenantId)
    .eq("id", voucherId);
  if (error) throw new Error(error.message);

  const { error: eventError } = await supabase.from("inst_voucher_events").insert({
    tenant_id: tenantId,
    voucher_id: voucherId,
    event_type: "void",
    amount_cents: 0,
    balance_after_cents: voucher.current_balance_cents,
    source_channel: input?.sourceChannel ?? "admin",
    idempotency_key: input?.idempotencyKey?.trim() || null,
    metadata: input?.metadata ?? {},
  });
  if (eventError) throw new Error(eventError.message);
}

export async function getVoucherByCode(
  supabase: Db,
  tenantId: string,
  code: string,
): Promise<Database["public"]["Tables"]["inst_vouchers"]["Row"] | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const { data } = await supabase
    .from("inst_vouchers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", normalized)
    .maybeSingle();
  return data;
}

export async function listVouchers(
  supabase: Db,
  tenantId: string,
  opts?: { search?: string; limit?: number },
): Promise<Database["public"]["Tables"]["inst_vouchers"]["Row"][]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  let query = supabase
    .from("inst_vouchers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const search = opts?.search?.trim();
  if (search) query = query.ilike("code", `%${search.toUpperCase()}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface IssueGiftCardWithPdfInput {
  amountCents: number;
  recipientName?: string | null;
  message?: string | null;
  templateId?: string | null;
  sourceChannel?: VoucherSource;
  clientId?: string | null;
  expiresAt?: string | null;
  wooOrderId?: number | null;
  wooProductId?: number | null;
  saleId?: string | null;
  idempotencyKey?: string | null;
  codePrefix?: string;
  currency?: string;
}

export async function issueGiftCardWithPdf(
  supabase: Db,
  tenantId: string,
  input: IssueGiftCardWithPdfInput,
): Promise<{
  id: string;
  code: string;
  current_balance_cents: number;
  pdfPath: string | null;
}> {
  const { generateGiftCardCode } = await import("@/lib/institut/pos-session");
  const {
    ensureDefaultVoucherTemplate,
    generateAndStoreGiftCardPdf,
    getVoucherTemplateById,
  } = await import("@/lib/institut/voucher-pdf");

  if (input.amountCents <= 0) throw new Error("invalid_amount");

  if (input.idempotencyKey?.trim()) {
    const { data: existingEvent } = await supabase
      .from("inst_voucher_events")
      .select("voucher_id")
      .eq("tenant_id", tenantId)
      .eq("event_type", "issue")
      .eq("idempotency_key", input.idempotencyKey.trim())
      .maybeSingle();
    if (existingEvent?.voucher_id) {
      const { data: voucher } = await supabase
        .from("inst_vouchers")
        .select("id, code, current_balance_cents, metadata")
        .eq("tenant_id", tenantId)
        .eq("id", existingEvent.voucher_id)
        .maybeSingle();
      if (voucher) {
        const meta =
          voucher.metadata && typeof voucher.metadata === "object" && !Array.isArray(voucher.metadata)
            ? (voucher.metadata as Record<string, unknown>)
            : {};
        return {
          id: voucher.id,
          code: voucher.code,
          current_balance_cents: voucher.current_balance_cents,
          pdfPath: typeof meta.pdf_path === "string" ? meta.pdf_path : null,
        };
      }
    }
  }

  const template = input.templateId
    ? ((await getVoucherTemplateById(supabase, tenantId, input.templateId)) ??
      (await ensureDefaultVoucherTemplate(supabase, tenantId)))
    : await ensureDefaultVoucherTemplate(supabase, tenantId);

  const prefix = (input.codePrefix?.trim() || "GC").toUpperCase();
  let code = generateGiftCardCode(prefix);
  let voucher: { id: string; code: string; current_balance_cents: number } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      voucher = await issueVoucher(supabase, tenantId, {
        code,
        voucherType: "gift_card",
        sourceChannel: input.sourceChannel ?? "pos",
        amountCents: input.amountCents,
        currency: input.currency,
        recipientName: input.recipientName ?? null,
        clientId: input.clientId ?? null,
        expiresAt: input.expiresAt ?? null,
        saleId: input.saleId ?? null,
        wooOrderId: input.wooOrderId ?? null,
        metadata: {
          template_id: template?.id ?? null,
          message: input.message?.trim() || null,
          woo_product_id: input.wooProductId ?? null,
          woo_order_id: input.wooOrderId ?? null,
        },
        idempotencyKey: input.idempotencyKey ?? null,
      });
      break;
    } catch (e) {
      const msg = (e as Error).message.toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        code = generateGiftCardCode(prefix);
        continue;
      }
      throw e;
    }
  }
  if (!voucher) throw new Error("gift_card_create_failed");

  let pdfPath: string | null = null;
  if (template) {
    try {
      pdfPath = await generateAndStoreGiftCardPdf(
        supabase,
        tenantId,
        voucher.id,
        template,
        {
          code: voucher.code,
          amountCents: input.amountCents,
          recipientName: input.recipientName,
          message: input.message,
          expiresAt: input.expiresAt,
          currency: input.currency,
        },
      );
      const { data: current } = await supabase
        .from("inst_vouchers")
        .select("metadata")
        .eq("id", voucher.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const prev =
        current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
          ? (current.metadata as Record<string, unknown>)
          : {};
      await supabase
        .from("inst_vouchers")
        .update({
          metadata: {
            ...prev,
            template_id: template.id,
            message: input.message?.trim() || null,
            pdf_path: pdfPath,
            pdf_generated_at: new Date().toISOString(),
          },
        })
        .eq("id", voucher.id)
        .eq("tenant_id", tenantId);
    } catch (e) {
      console.error("[issueGiftCardWithPdf] pdf generation failed", e);
    }
  }

  return {
    id: voucher.id,
    code: voucher.code,
    current_balance_cents: voucher.current_balance_cents,
    pdfPath,
  };
}
