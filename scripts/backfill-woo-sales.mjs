#!/usr/bin/env node
/**
 * One-off backfill for orphan Woo sale_items.
 *
 * Refetches WooCommerce products, their variations, and — for sales whose
 * items are still orphaned — refetches the original Woo order to recover
 * parent product_id + variation_id, then upserts everything and links
 * `inst_sale_items.product_id`.
 *
 * Usage:
 *   node scripts/backfill-woo-sales.mjs <tenantId>
 *
 * Requires .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and the
 * tenant to have a connected Woo connection with encrypted credentials.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { createDecipheriv } = require("node:crypto");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: node scripts/backfill-woo-sales.mjs <tenantId>");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CREDS_ENC_KEY = process.env.CONNECTIONS_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!CREDS_ENC_KEY) {
  console.error("Missing CONNECTIONS_ENCRYPTION_KEY");
  process.exit(1);
}
const CREDS_KEY = Buffer.from(CREDS_ENC_KEY, "base64");
if (CREDS_KEY.length !== 32) {
  console.error("CONNECTIONS_ENCRYPTION_KEY must decode to 32 bytes (base64).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function decryptCredentials(payload) {
  const enc = typeof payload?.enc === "string" ? payload.enc : null;
  if (!enc) return null;
  const raw = Buffer.from(enc, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const cipher = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", CREDS_KEY, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

async function getWooCreds(tenantId) {
  const { data } = await supabase
    .from("connections")
    .select("id, credentials, config, status")
    .eq("scope_type", "tenant")
    .eq("scope_id", tenantId)
    .eq("provider", "woocommerce")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.credentials) return null;
  const creds = decryptCredentials(data.credentials);
  if (!creds?.url || !creds?.consumerKey || !creds?.consumerSecret) return null;
  return { connectionId: data.id, ...creds };
}

async function wooFetch(base, auth, path, query) {
  const url = new URL(base + path);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Woo ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function priceToCents(v) {
  const n = Number.parseFloat(v ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function mapProductRow(tenantId, connectionId, product) {
  const categories = Array.isArray(product.categories)
    ? product.categories.map((c) => (typeof c?.name === "string" ? c.name.trim() : "")).filter(Boolean)
    : [];
  return {
    tenant_id: tenantId,
    connection_id: connectionId,
    woo_id: product.id,
    parent_woo_id: null,
    variation_attributes: {},
    name: product.name,
    sku: product.sku || null,
    price_cents: priceToCents(product.price),
    stock_quantity: product.stock_quantity ?? null,
    image_url: product.images?.[0]?.src ?? null,
    woo_categories: categories,
    status: product.status === "publish" ? "active" : product.status,
    source: "woocommerce",
    synced_at: new Date().toISOString(),
    is_gift_card: false,
    gift_template_id: null,
    gift_variation_templates: {},
  };
}

function mapVariationRow(tenantId, connectionId, parent, variation) {
  const parentCategories = Array.isArray(parent.categories)
    ? parent.categories.map((c) => (typeof c?.name === "string" ? c.name.trim() : "")).filter(Boolean)
    : [];
  const attrs = {};
  for (const a of variation.attributes ?? []) {
    const k = a.name?.trim();
    const v = a.option?.trim();
    if (k && v) attrs[k] = v;
  }
  const suffix = Object.values(attrs).filter(Boolean).join(" / ");
  return {
    tenant_id: tenantId,
    connection_id: connectionId,
    woo_id: variation.id,
    parent_woo_id: parent.id,
    variation_attributes: attrs,
    name: variation.name?.trim() || (suffix ? `${parent.name} — ${suffix}` : parent.name),
    sku: variation.sku?.trim() || parent.sku?.trim() || null,
    price_cents: priceToCents(variation.price ?? parent.price ?? "0"),
    stock_quantity: typeof variation.stock_quantity === "number" ? variation.stock_quantity : parent.stock_quantity ?? null,
    image_url: variation.image?.src ?? parent.images?.[0]?.src ?? null,
    woo_categories: parentCategories,
    status: (variation.status ?? parent.status) === "publish" ? "active" : variation.status ?? parent.status,
    source: "woocommerce",
    synced_at: new Date().toISOString(),
    is_gift_card: false,
    gift_template_id: null,
    gift_variation_templates: {},
  };
}

async function main() {
  const creds = await getWooCreds(tenantId);
  if (!creds) {
    console.error("No connected Woo credentials for tenant", tenantId);
    process.exit(1);
  }
  const base = creds.url.replace(/\/+$/, "") + "/wp-json/wc/v3";
  const auth = "Basic " + Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  // 1) Fetch orphan sale items
  const { data: orphans } = await supabase
    .from("inst_sale_items")
    .select("id, sale_id, name")
    .eq("tenant_id", tenantId)
    .eq("item_type", "product")
    .is("product_id", null)
    .ilike("name", "%Woo #%");
  console.log(`Orphan sale items: ${orphans?.length ?? 0}`);
  if (!orphans || orphans.length === 0) return;

  const saleIds = [...new Set(orphans.map((r) => r.sale_id))];
  const { data: sales } = await supabase
    .from("inst_sales")
    .select("id, notes, woo_order_id")
    .eq("tenant_id", tenantId)
    .in("id", saleIds);

  const orderIds = new Set();
  for (const s of sales ?? []) {
    if (s.woo_order_id) orderIds.add(Number(s.woo_order_id));
    else {
      const m = s.notes?.match(/WooCommerce\s*#(\d+)/i);
      if (m) orderIds.add(Number.parseInt(m[1], 10));
    }
  }
  console.log(`Related Woo orders: ${orderIds.size}`);

  // 2) For each order, fetch parents + variations and upsert
  for (const orderId of orderIds) {
    console.log(`→ Fetching order #${orderId}`);
    let order;
    try {
      order = await wooFetch(base, auth, `/orders/${orderId}`);
    } catch (err) {
      console.warn(`  order fetch failed: ${err.message}`);
      continue;
    }
    for (const line of order.line_items ?? []) {
      const productId = Number(line.product_id ?? 0);
      const variationId = Number(line.variation_id ?? 0);
      if (productId <= 0) continue;
      try {
        const parent = await wooFetch(base, auth, `/products/${productId}`);
        console.log(`  ↳ parent #${productId} (${parent.name}) — type=${parent.type}`);
        await supabase.from("inst_products").upsert(mapProductRow(tenantId, creds.connectionId, parent), {
          onConflict: "tenant_id,connection_id,woo_id",
        });
        if (variationId > 0) {
          try {
            const variation = await wooFetch(base, auth, `/products/${productId}/variations/${variationId}`);
            console.log(`    ↳ variation #${variationId} attrs=${JSON.stringify(variation.attributes?.map((a) => `${a.name}:${a.option}`) ?? [])}`);
            await supabase.from("inst_products").upsert(mapVariationRow(tenantId, creds.connectionId, parent, variation), {
              onConflict: "tenant_id,connection_id,woo_id",
            });
          } catch (err) {
            console.warn(`    variation fetch failed: ${err.message}`);
          }
        }
      } catch (err) {
        console.warn(`  product fetch failed for #${productId}: ${err.message}`);
      }
    }
  }

  // 3) Link orphan sale items
  const rx = /Woo\s*#(\d+)/i;
  let linked = 0;
  for (const row of orphans) {
    const m = row.name?.match(rx);
    if (!m) continue;
    const wooId = Number.parseInt(m[1], 10);
    const { data: product } = await supabase
      .from("inst_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("woo_id", wooId)
      .maybeSingle();
    if (!product) {
      console.log(`  ✗ still missing: ${row.name} (woo_id=${wooId})`);
      continue;
    }
    const { error } = await supabase
      .from("inst_sale_items")
      .update({ product_id: product.id })
      .eq("id", row.id)
      .eq("tenant_id", tenantId);
    if (!error) linked += 1;
  }
  console.log(`Linked ${linked}/${orphans.length} orphan sale items`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
