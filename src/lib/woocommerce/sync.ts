import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createServiceClient, tryCreateServiceClient } from "@/lib/supabase/service";
import { WOO_PROVIDER } from "@/lib/woocommerce";
import { parseStoredWooCredentials } from "@/lib/woocommerce/credentials";
import { WooClient, type WooProduct, type WooProductCategory, type WooProductVariation } from "@/lib/woocommerce/client";
import { collectWooCategoryNames } from "@/lib/woocommerce/product-labels";

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

export function categoryTreeById(
  categories: WooProductCategory[],
): Map<number, WooProductCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

function ancestorNamesForProduct(
  product: WooProduct,
  tree?: Map<number, WooProductCategory>,
): string[] {
  if (!tree || tree.size === 0) return [];
  const names: string[] = [];
  const seen = new Set<number>();
  const walk = (id: number) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const node = tree.get(id);
    if (!node) return;
    if (node.name?.trim()) names.push(node.name.trim());
    if (node.parent) walk(node.parent);
  };
  for (const cat of product.categories ?? []) {
    if (typeof cat?.id === "number") walk(cat.id);
  }
  return names;
}

export function mapWooProductToRow(
  tenantId: string,
  connectionId: string,
  product: WooProduct,
  tree?: Map<number, WooProductCategory>,
) {
  const categories = collectWooCategoryNames({
    name: product.name,
    categories: product.categories,
    brands: product.brands,
    attributes: product.attributes,
    ancestorNames: ancestorNamesForProduct(product, tree),
  });

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
    parent_woo_id: null,
    variation_attributes: {} as Record<string, string>,
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

/**
 * Convertit une variation Woo en row `inst_products`.
 *
 * On la stocke dans la meme table que les produits parents (meme besoins pour
 * l'app : image, prix, stock, categories, sku). On lie au parent via
 * `parent_woo_id` pour pouvoir grouper si besoin, et on herite des categories
 * du parent (les variations n'en portent pas cote Woo).
 */
export function mapWooVariationToRow(
  tenantId: string,
  connectionId: string,
  parent: WooProduct,
  variation: WooProductVariation,
  tree?: Map<number, WooProductCategory>,
) {
  const parentCategories = collectWooCategoryNames({
    name: parent.name,
    categories: parent.categories,
    brands: parent.brands,
    attributes: parent.attributes,
    ancestorNames: ancestorNamesForProduct(parent, tree),
  });

  const attributes: Record<string, string> = {};
  for (const attr of variation.attributes ?? []) {
    const key = attr.name?.trim();
    const value = attr.option?.trim();
    if (key && value) attributes[key] = value;
  }

  const attrSuffix = Object.values(attributes).filter(Boolean).join(" / ");
  const derivedName = attrSuffix ? `${parent.name} — ${attrSuffix}` : parent.name;

  const variationImage = variation.image?.src ?? null;
  const fallbackImage = parent.images?.[0]?.src ?? null;

  // Woo renvoie souvent variation.name = "150€, Par Email" (résumé des attrs),
  // ce qui n'est pas parlant seul. Si le nom du parent n'y figure pas, on
  // prefixe pour rendre la ligne comprehensible dans un historique.
  const rawVarName =
    typeof variation.name === "string" && variation.name.trim()
      ? variation.name.trim()
      : "";
  const parentNameTrim = parent.name?.trim() ?? "";
  let finalName: string;
  if (!rawVarName) {
    finalName = derivedName;
  } else if (parentNameTrim && !rawVarName.toLowerCase().includes(parentNameTrim.toLowerCase())) {
    finalName = `${parentNameTrim} — ${rawVarName}`;
  } else {
    finalName = rawVarName;
  }

  return {
    tenant_id: tenantId,
    connection_id: connectionId,
    woo_id: variation.id,
    parent_woo_id: parent.id,
    variation_attributes: attributes,
    name: finalName,
    sku: variation.sku?.trim() || parent.sku?.trim() || null,
    price_cents: priceToCents(variation.price ?? parent.price ?? "0"),
    stock_quantity:
      typeof variation.stock_quantity === "number"
        ? variation.stock_quantity
        : parent.stock_quantity,
    image_url: variationImage ?? fallbackImage,
    woo_categories: parentCategories,
    status:
      (variation.status ?? parent.status) === "publish"
        ? "active"
        : (variation.status ?? parent.status),
    source: "woocommerce" as const,
    synced_at: new Date().toISOString(),
    is_gift_card: false,
    gift_template_id: null,
    gift_variation_templates: {} as Record<string, string>,
  };
}

/** Upsert en batch de variations pour un produit parent. */
export async function upsertWooVariations(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  parent: WooProduct,
  variations: WooProductVariation[],
  tree?: Map<number, WooProductCategory>,
): Promise<number> {
  if (variations.length === 0) return 0;
  const rows = variations.map((v) =>
    mapWooVariationToRow(tenantId, connectionId, parent, v, tree),
  );
  const { error } = await supabase
    .from("inst_products")
    .upsert(rows, { onConflict: "tenant_id,connection_id,woo_id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Upsert un produit WooCommerce dans inst_products. */
export async function upsertWooProduct(
  supabase: Db,
  tenantId: string,
  connectionId: string,
  product: WooProduct,
  tree?: Map<number, WooProductCategory>,
): Promise<void> {
  const row = mapWooProductToRow(tenantId, connectionId, product, tree);
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

/**
 * Rattache les `sale_items` orphelins (`product_id is null`) à leur produit
 * Woo. Stratégie en 3 passes :
 *  1. Lookup direct par `woo_id` extrait du placeholder `Woo #<id>` en base.
 *  2. Fetch à la volée du produit `wooId` s'il n'est pas retrouvé (peut
 *     échouer si `wooId` est en fait une variation).
 *  3. Refetch de la commande Woo originale (via `notes = "WooCommerce #<id>"`)
 *     pour récupérer les vrais `product_id` (parent) + `variation_id` de
 *     chaque ligne, puis upsert parent + variations et re-tenter le lookup.
 *
 * @returns nombre de sale_items ré-associés
 */
export async function backfillOrphanWooSaleItems(
  supabase: Db,
  tenantId: string,
  opts?: { fetchMissingFromWoo?: boolean; connectionId?: string },
): Promise<number> {
  const { data: orphans } = await supabase
    .from("inst_sale_items")
    .select("id, sale_id, name")
    .eq("tenant_id", tenantId)
    .eq("item_type", "product")
    .is("product_id", null)
    .ilike("name", "%Woo #%");
  if (!orphans || orphans.length === 0) return 0;

  const rx = /Woo\s*#(\d+)/i;
  const idByItem = new Map<string, { wooId: number; saleId: string }>();
  const wooIds = new Set<number>();
  const saleIds = new Set<string>();
  for (const row of orphans) {
    const m = row.name?.match(rx);
    if (!m) continue;
    const wooId = Number.parseInt(m[1], 10);
    if (!Number.isFinite(wooId) || wooId <= 0) continue;
    idByItem.set(row.id, { wooId, saleId: row.sale_id });
    wooIds.add(wooId);
    saleIds.add(row.sale_id);
  }
  if (wooIds.size === 0) return 0;

  const productByWooId = new Map<
    number,
    { id: string; name: string; parent_woo_id: number | null }
  >();
  const loadMissing = async () => {
    const missing = Array.from(wooIds).filter((id) => !productByWooId.has(id));
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("inst_products")
      .select("id, name, woo_id, parent_woo_id")
      .eq("tenant_id", tenantId)
      .in("woo_id", missing);
    for (const p of data ?? []) {
      if (p.woo_id != null) {
        productByWooId.set(Number(p.woo_id), {
          id: p.id,
          name: p.name,
          parent_woo_id: p.parent_woo_id,
        });
      }
    }
  };
  await loadMissing();

  const shouldFetch = opts?.fetchMissingFromWoo && opts.connectionId;
  let woo: import("./client").WooClient | null = null;
  if (shouldFetch) {
    try {
      const creds = await getWooCredentialsForTenant(tenantId, supabase);
      if (creds) {
        const { WooClient } = await import("./client");
        woo = new WooClient(creds);
      }
    } catch {
      woo = null;
    }
  }

  // Passe 2 : essai fetch direct (parents seulement).
  if (woo && opts?.connectionId) {
    const stillMissing = Array.from(wooIds).filter((id) => !productByWooId.has(id));
    for (const wooId of stillMissing) {
      try {
        const product = await woo.getProduct(wooId);
        await supabase
          .from("inst_products")
          .upsert(mapWooProductToRow(tenantId, opts.connectionId, product), {
            onConflict: "tenant_id,connection_id,woo_id",
          });
      } catch {
        // Ignoré : peut-être une variation → passe 3.
      }
    }
    await loadMissing();
  }

  // Passe 3 : refetch des commandes Woo pour récupérer parent + variation.
  if (woo && opts?.connectionId) {
    const stillMissingWooIds = Array.from(wooIds).filter(
      (id) => !productByWooId.has(id),
    );
    if (stillMissingWooIds.length > 0 && saleIds.size > 0) {
      const { data: sales } = await supabase
        .from("inst_sales")
        .select("id, notes, woo_order_id")
        .eq("tenant_id", tenantId)
        .in("id", Array.from(saleIds));

      const rxOrder = /WooCommerce\s*#(\d+)/i;
      const orderIds = new Set<number>();
      for (const s of sales ?? []) {
        if (s.woo_order_id) {
          orderIds.add(Number(s.woo_order_id));
          continue;
        }
        const m = s.notes?.match(rxOrder);
        if (m) {
          const oid = Number.parseInt(m[1], 10);
          if (Number.isFinite(oid) && oid > 0) orderIds.add(oid);
        }
      }

      for (const orderId of orderIds) {
        try {
          const order = await woo.getOrder(orderId);
          const lineItems = order.line_items ?? [];
          for (const line of lineItems) {
            const productId = Number(line.product_id ?? 0);
            const variationId = Number(line.variation_id ?? 0);
            if (productId <= 0) continue;
            try {
              const parent = await woo.getProduct(productId);
              await supabase
                .from("inst_products")
                .upsert(
                  mapWooProductToRow(tenantId, opts.connectionId, parent),
                  { onConflict: "tenant_id,connection_id,woo_id" },
                );
              if (variationId > 0) {
                try {
                  const variation = await woo.getProductVariation(
                    productId,
                    variationId,
                  );
                  await supabase
                    .from("inst_products")
                    .upsert(
                      mapWooVariationToRow(
                        tenantId,
                        opts.connectionId,
                        parent,
                        variation,
                      ),
                      { onConflict: "tenant_id,connection_id,woo_id" },
                    );
                } catch (err) {
                  console.warn("[backfill] variation refetch failed", {
                    productId,
                    variationId,
                    message: (err as Error).message,
                  });
                }
              }
            } catch (err) {
              console.warn("[backfill] parent refetch failed", {
                productId,
                message: (err as Error).message,
              });
            }
          }
        } catch (err) {
          console.warn("[backfill] order refetch failed", {
            orderId,
            message: (err as Error).message,
          });
        }
      }
      await loadMissing();
    }
  }

  let updated = 0;
  for (const [itemId, { wooId }] of idByItem) {
    const match = productByWooId.get(wooId);
    if (!match) continue;
    const { error } = await supabase
      .from("inst_sale_items")
      .update({ product_id: match.id })
      .eq("tenant_id", tenantId)
      .eq("id", itemId)
      .is("product_id", null);
    if (!error) updated += 1;
  }
  return updated;
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

/**
 * Baisse le stock Woo d'un produit miroir après une vente caisse.
 * Ne crée pas de commande Woo : la vente reste dans BeautyHub.
 */
export async function decrementWooMirrorStock(
  supabase: Db,
  tenantId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const { data: product } = await supabase
    .from("inst_products")
    .select("woo_id, parent_woo_id, source")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();

  const wooId = product?.woo_id;
  if (!wooId || product.source === "internal") return;

  const creds = await getWooCredentialsForTenant(tenantId, supabase);
  if (!creds) return;

  const woo = new WooClient(creds);
  const parentId = product.parent_woo_id;
  try {
    if (parentId) {
      const variation = await woo.getProductVariation(parentId, wooId);
      const current =
        typeof variation.stock_quantity === "number" ? variation.stock_quantity : null;
      if (current === null) return;
      const next = Math.max(0, current - quantity);
      const updated = await woo.updateVariationStock(parentId, wooId, next);
      await supabase
        .from("inst_products")
        .update({
          stock_quantity:
            typeof updated.stock_quantity === "number" ? updated.stock_quantity : next,
          synced_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("id", productId);
      return;
    }

    const remote = await woo.getProduct(wooId);
    const current =
      typeof remote.stock_quantity === "number" ? remote.stock_quantity : null;
    if (current === null) return;
    const next = Math.max(0, current - quantity);
    const updated = await woo.updateProductStock(wooId, next);
    await supabase
      .from("inst_products")
      .update({
        stock_quantity:
          typeof updated.stock_quantity === "number" ? updated.stock_quantity : next,
        synced_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", productId);
  } catch {
    // La vente caisse ne doit pas échouer si Woo est injoignable.
  }
}

/**
 * Credentials déchiffrés pour opérations serveur (webhook, cron).
 *
 * Par défaut passe par le service client (bypass RLS, requis pour webhooks
 * anonymes). Passer `supabaseOverride` pour utiliser un client user-authenticated
 * quand la route API est dans un contexte tenant : cela évite de dépendre de
 * `SUPABASE_SERVICE_ROLE_KEY` et laisse la policy RLS `connections_access`
 * gérer l'accès.
 */
export async function getWooCredentialsForTenant(
  tenantId: string,
  supabaseOverride?: SupabaseClient<Database>,
): Promise<{ url: string; consumerKey: string; consumerSecret: string } | null> {
  const supabase = supabaseOverride ?? tryCreateServiceClient();
  if (!supabase) return null;
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

  const creds = parseStoredWooCredentials(data.credentials);
  if (!creds) return null;

  return {
    url: creds.url,
    consumerKey: creds.consumerKey,
    consumerSecret: creds.consumerSecret,
  };
}
