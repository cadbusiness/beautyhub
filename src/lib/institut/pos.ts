import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { classifyWooProduct } from "@/lib/woocommerce/product-labels";

type Db = SupabaseClient<Database>;

export type PosCategory = "all" | "service" | "woocommerce" | "internal";

export interface PosCatalogItem {
  /** Cle panier: service:{id} ou product:{id} */
  key: string;
  type: "service" | "product";
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  color: string | null;
  category: "service" | "woocommerce" | "internal";
  duration_min?: number;
  sku?: string | null;
  barcode?: string | null;
  woo_categories?: string[];
  woo_brands?: string[];
  woo_soins?: Array<"Visage" | "Corps" | "Cheveux" | "autres">;
  service_category_id?: string | null;
  service_category_name?: string | null;
  product_category_id?: string | null;
  product_category_name?: string | null;
  sold_qty?: number;
  visibility?: string;
  is_appointment_extra?: boolean;
}

export interface PosServiceCategory {
  id: string;
  name: string;
}

export type PosProductCategory = PosServiceCategory;

export interface ResolvedCartLine {
  key: string;
  type: "service" | "product";
  name: string;
  quantity: number;
  unit_price_cents: number;
  product_id: string | null;
  service_id: string | null;
  woo_id: number | null;
}

export const CUSTOM_POS_DEFAULT_NAME = "Encaissement libre";

export function isPosCartKey(key: string): boolean {
  return (
    key.startsWith("service:") ||
    key.startsWith("product:") ||
    key.startsWith("custom:")
  );
}

export function isCustomPosKey(key: string): boolean {
  return key.startsWith("custom:");
}

export function customPosLineName(key: string): string {
  if (!isCustomPosKey(key)) return CUSTOM_POS_DEFAULT_NAME;
  const rest = key.slice("custom:".length);
  const sep = rest.indexOf(":");
  if (sep < 0) return CUSTOM_POS_DEFAULT_NAME;
  const raw = rest.slice(sep + 1);
  if (!raw) return CUSTOM_POS_DEFAULT_NAME;
  try {
    return decodeURIComponent(raw).trim() || CUSTOM_POS_DEFAULT_NAME;
  } catch {
    return raw.trim() || CUSTOM_POS_DEFAULT_NAME;
  }
}

export function createCustomPosKey(name?: string | null): string {
  const label = (name?.trim() || CUSTOM_POS_DEFAULT_NAME).slice(0, 80);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `custom:${id}:${encodeURIComponent(label)}`;
}

export function customPosCatalogItem(
  key: string,
  priceCents = 0,
): PosCatalogItem {
  return {
    key,
    type: "service",
    id: key,
    name: customPosLineName(key),
    price_cents: priceCents,
    image_url: null,
    color: null,
    category: "service",
  };
}

export function resolvePosCatalogItem(
  key: string,
  catalog: PosCatalogItem[],
  priceCents = 0,
): PosCatalogItem | null {
  const found = catalog.find((item) => item.key === key);
  if (found) return found;
  if (!isCustomPosKey(key)) return null;
  return customPosCatalogItem(key, priceCents);
}

/** Parse le panier JSON { "service:uuid": 1, "product:uuid": 2 } */
export function parsePosCart(raw: string): Record<string, number> {
  const cart = JSON.parse(raw) as Record<string, number>;
  const out: Record<string, number> = {};
  for (const [key, qty] of Object.entries(cart)) {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (q > 0 && isPosCartKey(key)) {
      out[key] = q;
    }
  }
  return out;
}

/**
 * Parse une map d'overrides de prix { "service:uuid": 4500 } où la valeur
 * est le prix unitaire en centimes (dans le même mode HT/TTC que le catalogue).
 * Ignore les valeurs négatives, non finies, ou dont la clé n'est pas valide.
 */
export function parsePriceOverrides(
  raw: string | null | undefined,
): Record<string, number> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isPosCartKey(key)) continue;
    const cents = Math.round(Number(value));
    if (!Number.isFinite(cents) || cents < 0) continue;
    out[key] = cents;
  }
  return out;
}

/** Remise sur le prix unitaire catalogue : % ou montant fixe en euros. */
export function discountedUnitCents(
  catalogCents: number,
  kind: "percent" | "fixed",
  value: number,
): number {
  if (!Number.isFinite(catalogCents) || catalogCents < 0) return 0;
  if (!Number.isFinite(value) || value <= 0) return catalogCents;
  if (kind === "percent") {
    const pct = Math.min(100, value);
    return Math.max(0, Math.round(catalogCents * (1 - pct / 100)));
  }
  const off = Math.round(value * 100);
  return Math.max(0, catalogCents - off);
}

/** Applique des overrides de prix unitaires (par clé) à un ensemble de lignes résolues. */
export function applyPriceOverrides(
  lines: ResolvedCartLine[],
  overrides: Record<string, number> | null | undefined,
): ResolvedCartLine[] {
  if (!overrides || Object.keys(overrides).length === 0) return lines;
  return lines.map((line) => {
    const override = overrides[line.key];
    if (typeof override !== "number" || !Number.isFinite(override) || override < 0) {
      return line;
    }
    return { ...line, unit_price_cents: override };
  });
}

export function cartTotal(
  cart: Record<string, number>,
  catalog: PosCatalogItem[],
): number {
  const byKey = new Map(catalog.map((i) => [i.key, i]));
  let total = 0;
  for (const [key, qty] of Object.entries(cart)) {
    const item = byKey.get(key);
    if (item) total += item.price_cents * qty;
  }
  return total;
}

/** Resout les lignes du panier avec prix et references. */
export async function resolveCartLines(
  supabase: Db,
  tenantId: string,
  cart: Record<string, number>,
): Promise<ResolvedCartLine[]> {
  const serviceIds: string[] = [];
  const productIds: string[] = [];
  for (const key of Object.keys(cart)) {
    const [, id] = key.split(":");
    if (!id) continue;
    if (key.startsWith("service:")) serviceIds.push(id);
    else if (key.startsWith("product:")) productIds.push(id);
  }

  const [servicesRes, productsRes] = await Promise.all([
    serviceIds.length
      ? supabase
          .from("inst_services")
          .select("id, name, price_cents, color")
          .eq("tenant_id", tenantId)
          .in("id", serviceIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase
          .from("inst_products")
          .select("id, name, price_cents, woo_id")
          .eq("tenant_id", tenantId)
          .in("id", productIds)
          .in("status", ["active", "publish"])
      : Promise.resolve({ data: [] }),
  ]);

  const services = new Map((servicesRes.data ?? []).map((s) => [s.id, s]));
  const products = new Map((productsRes.data ?? []).map((p) => [p.id, p]));

  const lines: ResolvedCartLine[] = [];
  for (const [key, qty] of Object.entries(cart)) {
    const quantity = Math.max(1, qty);
    if (key.startsWith("service:")) {
      const id = key.slice(8);
      const s = services.get(id);
      if (!s) throw new Error(`Prestation introuvable: ${id}`);
      lines.push({
        key,
        type: "service",
        name: s.name,
        quantity,
        unit_price_cents: s.price_cents,
        product_id: null,
        service_id: s.id,
        woo_id: null,
      });
    } else if (key.startsWith("product:")) {
      const id = key.slice(8);
      const p = products.get(id);
      if (!p) throw new Error(`Produit introuvable: ${id}`);
      lines.push({
        key,
        type: "product",
        name: p.name,
        quantity,
        unit_price_cents: p.price_cents,
        product_id: p.id,
        service_id: null,
        woo_id: p.woo_id,
      });
    } else if (key.startsWith("custom:")) {
      lines.push({
        key,
        type: "service",
        name: customPosLineName(key),
        quantity,
        unit_price_cents: 0,
        product_id: null,
        service_id: null,
        woo_id: null,
      });
    }
  }
  return lines;
}

const SOLD_QTY_PAGE = 1000;
const SOLD_QTY_SALE_CHUNK = 200;

/** Quantités vendues (12 derniers mois, ventes payées hors avoirs). */
export async function fetchPosSoldQuantities(
  supabase: Db,
  tenantId: string,
): Promise<Map<string, number>> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const saleIds: string[] = [];
  for (let from = 0; ; from += SOLD_QTY_PAGE) {
    const { data } = await supabase
      .from("inst_sales")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("status", ["paid", "completed"])
      .neq("sale_kind", "refund")
      .gte("created_at", since.toISOString())
      .range(from, from + SOLD_QTY_PAGE - 1);
    const rows = data ?? [];
    for (const row of rows) saleIds.push(row.id);
    if (rows.length < SOLD_QTY_PAGE) break;
  }
  if (saleIds.length === 0) return new Map();

  const qty = new Map<string, number>();
  for (let i = 0; i < saleIds.length; i += SOLD_QTY_SALE_CHUNK) {
    const chunk = saleIds.slice(i, i + SOLD_QTY_SALE_CHUNK);
    const { data: items } = await supabase
      .from("inst_sale_items")
      .select("product_id, service_id, quantity")
      .eq("tenant_id", tenantId)
      .in("sale_id", chunk);
    for (const item of items ?? []) {
      const key = item.service_id
        ? `service:${item.service_id}`
        : item.product_id
          ? `product:${item.product_id}`
          : null;
      if (!key) continue;
      qty.set(key, (qty.get(key) ?? 0) + (item.quantity ?? 0));
    }
  }
  return qty;
}

export function buildCatalog(
  services: Array<{
    id: string;
    name: string;
    price_cents: number;
    color: string | null;
    duration_min: number;
    image_url?: string | null;
    visibility?: string;
    category_id?: string | null;
  }>,
  products: Array<{
    id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
    source?: string;
    sku: string | null;
    barcode?: string | null;
    color?: string | null;
    woo_id?: number | null;
    woo_categories?: string[] | null;
    category_id?: string | null;
  }>,
  extras?: {
    serviceCategories?: PosServiceCategory[];
    productCategories?: PosProductCategory[];
    soldQtyByKey?: Map<string, number>;
  },
): PosCatalogItem[] {
  const categoryNameById = new Map(
    (extras?.serviceCategories ?? []).map((c) => [c.id, c.name]),
  );
  const productCategoryNameById = new Map(
    (extras?.productCategories ?? []).map((c) => [c.id, c.name]),
  );
  const soldQtyByKey = extras?.soldQtyByKey ?? new Map<string, number>();

  const items: PosCatalogItem[] = services.map((s) => {
    const key = `service:${s.id}`;
    const categoryId = s.category_id ?? null;
    return {
      key,
      type: "service",
      id: s.id,
      name: s.name,
      price_cents: s.price_cents,
      image_url: s.image_url ?? null,
      color: s.color,
      category: "service",
      duration_min: s.duration_min,
      visibility: s.visibility,
      service_category_id: categoryId,
      service_category_name: categoryId
        ? (categoryNameById.get(categoryId) ?? null)
        : null,
      sold_qty: soldQtyByKey.get(key) ?? 0,
    };
  });

  for (const p of products) {
    const isWoo = p.source === "woocommerce" || (p.woo_id != null && p.source !== "internal");
    const key = `product:${p.id}`;
    const classified = isWoo
      ? classifyWooProduct(p.name, p.woo_categories ?? [])
      : { brands: [] as string[], soins: [] as Array<"Visage" | "Corps" | "Cheveux" | "autres"> };
    const productCategoryId = !isWoo ? (p.category_id ?? null) : null;
    items.push({
      key,
      type: "product",
      id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      image_url: p.image_url,
      color: p.color ?? null,
      category: isWoo ? "woocommerce" : "internal",
      sku: p.sku,
      barcode: p.barcode ?? null,
      woo_categories: p.woo_categories ?? [],
      woo_brands: classified.brands,
      woo_soins: classified.soins,
      product_category_id: productCategoryId,
      product_category_name: productCategoryId
        ? (productCategoryNameById.get(productCategoryId) ?? null)
        : null,
      sold_qty: soldQtyByKey.get(key) ?? 0,
    });
  }
  return items;
}
