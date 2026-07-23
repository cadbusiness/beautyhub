import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptCredentials } from "@/lib/connections/crypto";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import type { WooProduct } from "@/lib/woocommerce/client";

type Db = SupabaseClient<Database>;

export interface WooWebhookConnection {
  connectionId: string;
  tenantId: string;
  webhookSecret: string;
  shopUrl: string;
}

export function generateWebhookCredentials(): {
  webhookToken: string;
  webhookSecret: string;
} {
  return {
    webhookToken: randomBytes(24).toString("hex"),
    webhookSecret: randomBytes(32).toString("hex"),
  };
}

/** Résout une connexion Woo par le token webhook (route publique signée). */
export async function resolveWooWebhookConnection(
  token: string,
): Promise<WooWebhookConnection | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("connections")
    .select("id, scope_id, status, config, credentials")
    .eq("provider", WOO_PROVIDER)
    .eq("scope_type", "tenant")
    .eq("status", "connected")
    .filter("config->>webhook_token", "eq", token)
    .maybeSingle();

  if (!data?.scope_id) return null;

  const config = (data.config as Record<string, unknown>) ?? {};
  const webhookSecret =
    typeof config.webhook_secret === "string" ? config.webhook_secret : null;
  const shopUrl = typeof config.url === "string" ? config.url : null;
  if (!webhookSecret || !shopUrl) return null;

  return {
    connectionId: data.id,
    tenantId: data.scope_id,
    webhookSecret,
    shopUrl,
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

function priceToCents(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function metaValue(
  meta: Array<{ key: string; value: unknown }> | undefined,
  key: string,
): unknown {
  return meta?.find((m) => m.key === key)?.value;
}

function metaYes(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "1" || s === "true";
}

export function mapWooProductToRow(
  tenantId: string,
  connectionId: string,
  product: WooProduct,
) {
  const categories = Array.isArray(product.categories)
    ? product.categories
        .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
        .filter((name): name is string => name.length > 0)
    : [];

  const giftFlag = metaValue(product.meta_data, "_beautyhub_gift_card");
  const templateRaw = metaValue(product.meta_data, "_beautyhub_gift_template_id");
  const templateId =
    typeof templateRaw === "string" && templateRaw.trim().length > 0
      ? templateRaw.trim()
      : null;
  const variationsRaw = metaValue(product.meta_data, "_beautyhub_gift_variation_templates");
  let giftVariationTemplates: Record<string, string> = {};
  if (typeof variationsRaw === "string" && variationsRaw.trim()) {
    try {
      const parsed = JSON.parse(variationsRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        giftVariationTemplates = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string" && v.trim())
            .map(([k, v]) => [String(k), String(v).trim()]),
        );
      }
    } catch {
      giftVariationTemplates = {};
    }
  } else if (variationsRaw && typeof variationsRaw === "object" && !Array.isArray(variationsRaw)) {
    giftVariationTemplates = Object.fromEntries(
      Object.entries(variationsRaw as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => [String(k), String(v).trim()]),
    );
  }

  return {
    tenant_id: tenantId,
    connection_id: connectionId,
    woo_id: product.id,
    name: product.name,
    sku: product.sku || null,
    price_cents: priceToCents(product.price),
    stock_quantity: product.stock_quantity,
    image_url: product.images?.[0]?.src ?? null,
    woo_categories: categories,
    status: product.status === "publish" ? "active" : product.status,
    source: "woocommerce" as const,
    synced_at: new Date().toISOString(),
    is_gift_card: metaYes(giftFlag),
    gift_template_id: templateId,
    gift_variation_templates: giftVariationTemplates,
  };
}

/** Upsert un produit WooCommerce dans inst_products. */
export async function upsertWooProduct(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  product: WooProduct,
): Promise<void> {
  const row = mapWooProductToRow(tenantId, connectionId, product);
  let { error } = await supabase
    .from("inst_products")
    .upsert(row, { onConflict: "tenant_id,connection_id,woo_id" });
  // Invalid remote template UUID must not block catalogue sync.
  if (error?.message?.toLowerCase().includes("gift_template")) {
    ({ error } = await supabase.from("inst_products").upsert(
      { ...row, gift_template_id: null },
      { onConflict: "tenant_id,connection_id,woo_id" },
    ));
  }
  if (error) throw new Error(error.message);
}

/** Met à jour le stock local d'un produit Woo (par woo_id). */
export async function applyWooStockUpdate(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  wooId: number,
  stockQuantity: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("inst_products")
    .update({
      stock_quantity: stockQuantity,
      synced_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("connection_id", connectionId)
    .eq("woo_id", wooId)
    .eq("source", "woocommerce");
  if (error) throw new Error(error.message);
}

/** Désactive un produit miroir quand il est supprimé côté Woo. */
export async function deactivateWooProduct(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  wooId: number,
): Promise<void> {
  await supabase
    .from("inst_products")
    .update({ status: "trash", synced_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("connection_id", connectionId)
    .eq("woo_id", wooId);
}

/** Décrémente le stock local après vente caisse (interne ou Woo miroir). */
export async function decrementLocalProductStock(
  supabase: Db,
  tenantId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const { data: product } = await supabase
    .from("inst_products")
    .select("stock_quantity")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.stock_quantity === null) return;

  const newStock = Math.max(0, product.stock_quantity - quantity);
  await supabase
    .from("inst_products")
    .update({
      stock_quantity: newStock,
      synced_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", productId);
}

/** Credentials déchiffrés pour opérations serveur (webhook, cron). */
export async function getWooCredentialsForTenant(
  tenantId: string,
): Promise<{ url: string; consumerKey: string; consumerSecret: string } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("connections")
    .select("credentials, status")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", WOO_PROVIDER)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.credentials) return null;

  const creds = decryptCredentials(
    (data.credentials as { enc?: string }) ?? {},
  ) as Partial<{ url: string; consumerKey: string; consumerSecret: string }>;

  if (!creds.url || !creds.consumerKey || !creds.consumerSecret) return null;

  return {
    url: creds.url,
    consumerKey: creds.consumerKey,
    consumerSecret: creds.consumerSecret,
  };
}
