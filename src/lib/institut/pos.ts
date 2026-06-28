import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

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
  visibility?: string;
  is_appointment_extra?: boolean;
}

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

/** Parse le panier JSON { "service:uuid": 1, "product:uuid": 2 } */
export function parsePosCart(raw: string): Record<string, number> {
  const cart = JSON.parse(raw) as Record<string, number>;
  const out: Record<string, number> = {};
  for (const [key, qty] of Object.entries(cart)) {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (q > 0 && (key.startsWith("service:") || key.startsWith("product:"))) {
      out[key] = q;
    }
  }
  return out;
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
    }
  }
  return lines;
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
  }>,
  products: Array<{
    id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
    source?: string;
    sku: string | null;
    color?: string | null;
    woo_id?: number | null;
  }>,
): PosCatalogItem[] {
  const items: PosCatalogItem[] = services.map((s) => ({
    key: `service:${s.id}`,
    type: "service",
    id: s.id,
    name: s.name,
    price_cents: s.price_cents,
    image_url: s.image_url ?? null,
    color: s.color,
    category: "service",
    duration_min: s.duration_min,
    visibility: s.visibility,
  }));

  for (const p of products) {
    const isWoo = p.source === "woocommerce" || (p.woo_id != null && p.source !== "internal");
    items.push({
      key: `product:${p.id}`,
      type: "product",
      id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      image_url: p.image_url,
      color: p.color ?? null,
      category: isWoo ? "woocommerce" : "internal",
      sku: p.sku,
    });
  }
  return items;
}
