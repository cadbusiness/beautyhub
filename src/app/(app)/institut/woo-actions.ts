"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import {
  disconnectTenantConnection,
  saveTenantConnection,
} from "@/lib/connections";
import { WOO_PROVIDER, WooClient, getWooClientForTenant } from "@/lib/woocommerce";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

function priceToCents(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function saveWooConnection(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");

  const url = String(formData.get("url") ?? "").trim();
  const consumerKey = String(formData.get("consumer_key") ?? "").trim();
  const consumerSecret = String(formData.get("consumer_secret") ?? "").trim();
  if (!url || !consumerKey || !consumerSecret) {
    return { error: "URL, cle et secret requis." };
  }

  // Test de connexion avant d'enregistrer.
  try {
    const client = new WooClient({ url, consumerKey, consumerSecret });
    await client.testConnection();
  } catch (e) {
    return { error: `Connexion echouee: ${(e as Error).message}` };
  }

  try {
    await saveTenantConnection(
      session.tenant.id,
      WOO_PROVIDER,
      { url, consumerKey, consumerSecret },
      { url },
      "connected",
    );
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
  return { ok: true, message: "Boutique WooCommerce connectee." };
}

export async function disconnectWoo(): Promise<void> {
  const session = await requireModule("institut");
  await disconnectTenantConnection(session.tenant.id, WOO_PROVIDER);
  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
}

export async function syncWooProducts(): Promise<void> {
  const session = await requireModule("institut");
  const client = await getWooClientForTenant(session.tenant.id);
  if (!client) return;

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Jusqu'a 5 pages de 50 produits (250) pour le MVP.
  for (let page = 1; page <= 5; page++) {
    const products = await client.listProducts(page, 50);
    if (products.length === 0) break;

    const rows = products.map((p) => ({
      tenant_id: session.tenant.id,
      woo_id: p.id,
      name: p.name,
      sku: p.sku || null,
      price_cents: priceToCents(p.price),
      stock_quantity: p.stock_quantity,
      image_url: p.images?.[0]?.src ?? null,
      status: p.status,
      synced_at: now,
    }));

    await supabase
      .from("inst_products")
      .upsert(rows, { onConflict: "tenant_id,woo_id" });

    if (products.length < 50) break;
  }

  revalidatePath("/institut/caisse");
}

export async function checkout(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  let cart: Record<string, number>;
  try {
    cart = JSON.parse(String(formData.get("cart") ?? "{}"));
  } catch {
    return { error: "Panier invalide." };
  }
  const productIds = Object.keys(cart);
  if (productIds.length === 0) return { error: "Panier vide." };

  const { data: products } = await supabase
    .from("inst_products")
    .select("id, woo_id, name, price_cents")
    .eq("tenant_id", session.tenant.id)
    .in("id", productIds);
  if (!products || products.length === 0) return { error: "Produits introuvables." };

  let total = 0;
  const items = products.map((p) => {
    const qty = Math.max(1, Number(cart[p.id]) || 1);
    total += p.price_cents * qty;
    return { product: p, qty };
  });

  const clientId = String(formData.get("client_id") ?? "") || null;

  // Commande WooCommerce si la boutique est connectee.
  let wooOrderId: number | null = null;
  const client = await getWooClientForTenant(session.tenant.id);
  if (client) {
    const lineItems = items
      .filter((i) => i.product.woo_id)
      .map((i) => ({ product_id: Number(i.product.woo_id), quantity: i.qty }));
    if (lineItems.length > 0) {
      try {
        const order = await client.createOrder(lineItems, { setPaid: true });
        wooOrderId = order.id;
      } catch (e) {
        return { error: `Commande WooCommerce echouee: ${(e as Error).message}` };
      }
    }
  }

  const { data: sale, error: saleErr } = await supabase
    .from("inst_sales")
    .insert({
      tenant_id: session.tenant.id,
      client_id: clientId,
      woo_order_id: wooOrderId,
      total_cents: total,
      status: "paid",
    })
    .select("id")
    .single();
  if (saleErr || !sale) return { error: saleErr?.message ?? "Erreur vente." };

  const { error: itemsErr } = await supabase.from("inst_sale_items").insert(
    items.map((i) => ({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      product_id: i.product.id,
      name: i.product.name,
      quantity: i.qty,
      unit_price_cents: i.product.price_cents,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  revalidatePath("/institut/caisse");
  return {
    ok: true,
    message: wooOrderId
      ? `Vente enregistree (commande Woo #${wooOrderId}).`
      : "Vente enregistree.",
  };
}
