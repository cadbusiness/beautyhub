import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { findOrCreateClientFromExternal } from "@/lib/institut/clients-dedup";

type Db = SupabaseClient<Database>;

export type WooOrderWebhookPayload = {
  id: number;
  total?: number | string;
  currency?: string;
  date_completed?: string | null;
  customer_id?: number;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
  line_items?: Array<{
    product_id?: number;
    variation_id?: number;
    quantity?: number;
    total?: number | string;
    name?: string;
  }>;
  meta?: {
    payment_method?: string;
  };
};

function mapWooPaymentMethod(raw?: string): string {
  switch (raw) {
    case "stripe":
    case "woocommerce_payments":
      return "stripe";
    case "bacs":
      return "transfer";
    case "cod":
      return "cash";
    default:
      return "other";
  }
}

function parseTotalCents(total: unknown): number {
  const value = typeof total === "number" ? total : Number.parseFloat(String(total ?? "0"));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function parseLineTotalCents(total: unknown): number {
  const value = typeof total === "number" ? total : Number.parseFloat(String(total ?? "0"));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

export async function ingestWooCompletedOrder(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  payload: WooOrderWebhookPayload,
): Promise<{ created: boolean; saleId?: string }> {
  const wooOrderId = payload.id;

  const { data: existing } = await supabase
    .from("inst_sales")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("woo_order_id", wooOrderId)
    .maybeSingle();

  if (existing) {
    return { created: false, saleId: existing.id };
  }

  const totalCents = parseTotalCents(payload.total);
  if (totalCents <= 0) {
    return { created: false };
  }

  const posSettings = await getPosSettings(supabase, tenantId);
  const currency =
    typeof payload.currency === "string" && payload.currency.trim()
      ? payload.currency.toLowerCase()
      : posSettings.currency;

  const billing = payload.billing ?? {};
  const billingEmail = typeof billing.email === "string" ? billing.email.trim().toLowerCase() : "";
  const billingPhone = typeof billing.phone === "string" ? billing.phone.trim() : "";
  const firstName = typeof billing.first_name === "string" ? billing.first_name.trim() : "";
  const lastName = typeof billing.last_name === "string" ? billing.last_name.trim() : "";
  const wooCustomerId =
    typeof payload.customer_id === "number" && payload.customer_id > 0
      ? String(payload.customer_id)
      : null;

  let clientId: string | null = null;
  // On tente la dédup uniquement si on a au moins un identifiant discriminant.
  if (billingEmail || billingPhone || firstName || lastName || wooCustomerId) {
    try {
      const dedup = await findOrCreateClientFromExternal(supabase, {
        tenantId,
        source: "woo",
        externalId: wooCustomerId,
        phone: billingPhone || null,
        email: billingEmail || null,
        firstName: firstName || null,
        lastName: lastName || null,
        extraTags: ["WooCommerce"],
        metadata: {
          woo_customer_id: wooCustomerId ? Number(wooCustomerId) : undefined,
          woo_billing: {
            city: billing.city ?? null,
            postcode: billing.postcode ?? null,
            country: billing.country ?? null,
          },
        },
      });
      clientId = dedup.clientId;
    } catch (err) {
      console.error("[woo-order-sales] dedup client failed", err);
      clientId = null;
    }
  }

  const completedAt =
    typeof payload.date_completed === "string" && payload.date_completed.trim()
      ? payload.date_completed
      : new Date().toISOString();

  const { data: sale, error: saleErr } = await supabase
    .from("inst_sales")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      woo_order_id: wooOrderId,
      source_channel: "woo",
      subtotal_cents: totalCents,
      discount_cents: 0,
      vat_cents: 0,
      total_cents: totalCents,
      amount_paid_cents: totalCents,
      status: "paid",
      payment_method: mapWooPaymentMethod(payload.meta?.payment_method),
      sale_kind: "sale",
      currency,
      notes: `WooCommerce #${wooOrderId}`,
      created_at: completedAt,
    })
    .select("id")
    .single();

  if (saleErr || !sale) {
    if (saleErr?.code === "23505") {
      return { created: false };
    }
    throw new Error(saleErr?.message ?? "woo_sale_insert_failed");
  }

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  if (lineItems.length > 0) {
    const wooIds = lineItems
      .map((line) => {
        const variationId = line.variation_id ?? 0;
        const productId = line.product_id ?? 0;
        return variationId > 0 ? variationId : productId;
      })
      .filter((id) => id > 0);

    const productByWooId = new Map<number, string>();
    if (wooIds.length > 0) {
      const { data: products } = await supabase
        .from("inst_products")
        .select("id, woo_id")
        .eq("tenant_id", tenantId)
        .eq("connection_id", connectionId)
        .in("woo_id", wooIds);

      for (const product of products ?? []) {
        if (product.woo_id != null) {
          productByWooId.set(Number(product.woo_id), product.id);
        }
      }
    }

    const rows = lineItems.map((line) => {
      const quantity = Math.max(1, Number(line.quantity ?? 1));
      const lineTotalCents = parseLineTotalCents(line.total);
      const unitPriceCents =
        quantity > 0 ? Math.round(lineTotalCents / quantity) : lineTotalCents;
      const wooId =
        (line.variation_id ?? 0) > 0
          ? Number(line.variation_id)
          : Number(line.product_id ?? 0);

      return {
        tenant_id: tenantId,
        sale_id: sale.id,
        item_type: "product" as const,
        product_id: wooId > 0 ? (productByWooId.get(wooId) ?? null) : null,
        name:
          typeof line.name === "string" && line.name.trim()
            ? line.name.trim()
            : `Produit Woo #${wooId || "?"}`,
        quantity,
        unit_price_cents: unitPriceCents,
        vat_rate_bps: posSettings.product_vat_rate_bps,
        discount_cents: 0,
        line_subtotal_cents: lineTotalCents,
        line_vat_cents: 0,
        line_total_cents: lineTotalCents,
      };
    });

    const { error: itemsErr } = await supabase.from("inst_sale_items").insert(rows);
    if (itemsErr) throw new Error(itemsErr.message);
  }

  return { created: true, saleId: sale.id };
}
