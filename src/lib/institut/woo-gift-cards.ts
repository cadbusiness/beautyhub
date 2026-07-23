import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { issueGiftCardWithPdf } from "@/lib/institut/vouchers-core";
import { createSignedGiftCardPdfUrl } from "@/lib/institut/voucher-pdf";
import { getWooClientForTenant } from "@/lib/woocommerce";

type Db = SupabaseClient<Database>;

export type WooGiftLineItem = {
  product_id?: unknown;
  variation_id?: unknown;
  quantity?: unknown;
  total?: unknown;
  is_gift_card?: unknown;
  gift_template_id?: unknown;
};

function metaYes(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "1" || s === "true";
}

function asTemplateId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id || null;
}

async function resolveGiftContext(
  supabase: Db,
  tenantId: string,
  productId: number,
  variationId: number | null,
  payload: { isGift?: boolean; templateId?: string | null },
): Promise<{ isGift: boolean; templateId: string | null }> {
  const { data: local } = await supabase
    .from("inst_products")
    .select("is_gift_card, gift_template_id, gift_variation_templates")
    .eq("tenant_id", tenantId)
    .eq("woo_id", productId)
    .maybeSingle();

  let isGift = Boolean(local?.is_gift_card) || Boolean(payload.isGift);
  let templateId =
    (variationId &&
      local?.gift_variation_templates &&
      typeof local.gift_variation_templates === "object" &&
      !Array.isArray(local.gift_variation_templates) &&
      typeof (local.gift_variation_templates as Record<string, unknown>)[String(variationId)] ===
        "string"
      ? String(
          (local.gift_variation_templates as Record<string, unknown>)[String(variationId)],
        )
      : null) ||
    local?.gift_template_id ||
    payload.templateId ||
    null;

  if (isGift && templateId) {
    return { isGift, templateId };
  }

  const client = await getWooClientForTenant(tenantId);
  if (!client) return { isGift, templateId };

  try {
    if (variationId && variationId > 0) {
      const variations = await client.listProductVariations(productId);
      const variation = variations.find((v) => v.id === variationId);
      const varTpl = variation?.meta_data?.find((m) => m.key === "_beautyhub_gift_template_id");
      if (!templateId) templateId = asTemplateId(varTpl?.value);
    }

    const product = await client.getProduct(productId);
    const meta = product.meta_data ?? [];
    const giftMeta = meta.find((m) => m.key === "_beautyhub_gift_card");
    if (giftMeta && metaYes(giftMeta.value)) isGift = true;
    if (!templateId) {
      const tplMeta = meta.find((m) => m.key === "_beautyhub_gift_template_id");
      templateId = asTemplateId(tplMeta?.value);
    }
  } catch {
    // keep local/payload resolution
  }

  return { isGift, templateId };
}

/**
 * Issues BeautyHub gift cards for Woo order line items marked as gift products.
 * Writes `_beautyhub_gift_cards` order meta with code + signed PDF URL.
 */
export async function issueGiftCardsForWooOrder(
  supabase: Db,
  tenantId: string,
  orderId: number,
  lineItems: WooGiftLineItem[],
  opts?: {
    recipientName?: string | null;
    currency?: string | null;
  },
): Promise<Array<{ code: string; pdf_url: string | null; amount_cents: number }>> {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return [];

  const settings = await getPosSettings(supabase, tenantId);
  const currency = (opts?.currency?.trim() || settings.currency || "eur").toLowerCase();
  const issued: Array<{ code: string; pdf_url: string | null; amount_cents: number }> = [];

  for (const line of lineItems) {
    const productId =
      typeof line.product_id === "number"
        ? line.product_id
        : Number.parseInt(String(line.product_id ?? ""), 10);
    if (!Number.isFinite(productId) || productId <= 0) continue;

    const variationRaw =
      typeof line.variation_id === "number"
        ? line.variation_id
        : Number.parseInt(String(line.variation_id ?? "0"), 10);
    const variationId =
      Number.isFinite(variationRaw) && variationRaw > 0 ? Math.floor(variationRaw) : null;

    const qtyRaw =
      typeof line.quantity === "number"
        ? line.quantity
        : Number.parseInt(String(line.quantity ?? "1"), 10);
    const qty = Math.max(1, Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : 1);

    const totalRaw =
      typeof line.total === "number"
        ? line.total
        : Number.parseFloat(String(line.total ?? "0"));
    const lineTotal = Number.isFinite(totalRaw) ? totalRaw : 0;
    const amountCents = Math.max(1, Math.round((lineTotal / qty) * 100));

    const { isGift, templateId } = await resolveGiftContext(
      supabase,
      tenantId,
      productId,
      variationId,
      {
        isGift: metaYes(line.is_gift_card),
        templateId: asTemplateId(line.gift_template_id),
      },
    );
    if (!isGift) continue;

    for (let index = 0; index < qty; index++) {
      const card = await issueGiftCardWithPdf(supabase, tenantId, {
        amountCents,
        recipientName: opts?.recipientName?.trim() || null,
        sourceChannel: "woo",
        wooOrderId: orderId,
        wooProductId: productId,
        templateId,
        currency,
        codePrefix: settings.gift_card_prefix || "GC",
        idempotencyKey: `woo:order:${orderId}:gift:${productId}:${variationId ?? 0}:${index}`,
      });

      let pdfUrl: string | null = null;
      if (card.pdfPath) {
        pdfUrl = await createSignedGiftCardPdfUrl(supabase, card.pdfPath);
      }

      issued.push({
        code: card.code,
        pdf_url: pdfUrl,
        amount_cents: amountCents,
      });
    }
  }

  if (issued.length === 0) return [];

  const woo = await getWooClientForTenant(tenantId);
  if (woo) {
    try {
      await woo.updateOrderMeta(orderId, [
        { key: "_beautyhub_gift_cards", value: issued },
      ]);
    } catch (e) {
      console.error("[issueGiftCardsForWooOrder] updateOrderMeta failed", e);
    }
  }

  return issued;
}
