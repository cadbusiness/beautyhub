import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getPosSettings } from "@/lib/institut/pos-settings";
import { findOrCreateClientFromExternal } from "@/lib/institut/clients-dedup";
import { deriveWooCustomerNames } from "@/lib/woocommerce/customer-names";

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
  const wooCustomerId =
    typeof payload.customer_id === "number" && payload.customer_id > 0
      ? String(payload.customer_id)
      : null;

  // Utilise le même fallback (billing → username → préfixe email) que le bulk
  // import pour éviter les clients Woo `full_name = null`.
  const { firstName, lastName } = deriveWooCustomerNames({
    first_name: typeof billing.first_name === "string" ? billing.first_name : null,
    last_name: typeof billing.last_name === "string" ? billing.last_name : null,
    billing: {
      first_name: typeof billing.first_name === "string" ? billing.first_name : null,
      last_name: typeof billing.last_name === "string" ? billing.last_name : null,
      email: billingEmail || null,
    },
    email: billingEmail || null,
  });

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
        firstName,
        lastName,
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
    // On collecte à la fois les variation_id et les product_id (parent) : on ne
    // stocke que les produits parents dans `inst_products`, donc si la ligne
    // référence une variation, on veut retrouver le parent en fallback.
    const wooIds = new Set<number>();
    for (const line of lineItems) {
      const variationId = Number(line.variation_id ?? 0);
      const productId = Number(line.product_id ?? 0);
      if (variationId > 0) wooIds.add(variationId);
      if (productId > 0) wooIds.add(productId);
    }

    const productByWooId = new Map<number, { id: string; name: string | null }>();
    if (wooIds.size > 0) {
      const { data: products } = await supabase
        .from("inst_products")
        .select("id, woo_id, name")
        .eq("tenant_id", tenantId)
        .eq("connection_id", connectionId)
        .in("woo_id", Array.from(wooIds));

      for (const product of products ?? []) {
        if (product.woo_id != null) {
          productByWooId.set(Number(product.woo_id), {
            id: product.id,
            name: product.name,
          });
        }
      }
    }

    const rows = lineItems.map((line) => {
      const quantity = Math.max(1, Number(line.quantity ?? 1));
      const lineTotalCents = parseLineTotalCents(line.total);
      const unitPriceCents =
        quantity > 0 ? Math.round(lineTotalCents / quantity) : lineTotalCents;
      const variationId = Number(line.variation_id ?? 0);
      const productId = Number(line.product_id ?? 0);

      // Priorité : variation → parent. Le parent est la source de vérité en
      // base (image, catégories…).
      const matched =
        (variationId > 0 ? productByWooId.get(variationId) : undefined) ??
        (productId > 0 ? productByWooId.get(productId) : undefined) ??
        null;

      const displayId = variationId > 0 ? variationId : productId;
      const wooName =
        typeof line.name === "string" && line.name.trim()
          ? line.name.trim()
          : null;

      return {
        tenant_id: tenantId,
        sale_id: sale.id,
        item_type: "product" as const,
        product_id: matched?.id ?? null,
        name:
          wooName ?? matched?.name ?? `Produit Woo #${displayId || "?"}`,
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
