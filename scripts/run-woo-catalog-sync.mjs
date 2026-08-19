#!/usr/bin/env node
/**
 * Ops: pull Woo products into inst_products without the Next.js path aliases.
 *   node --env-file=.env.local scripts/run-woo-catalog-sync.mjs escale-des-sens
 */
import { createHash, createDecipheriv } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

function decryptEnc(payload, material) {
  const key = createHash("sha256").update(material).digest();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    ),
  );
}

function priceToCents(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function mapProduct(tenantId, connectionId, product) {
  const categories = [
    ...new Set(
      (product.categories ?? [])
        .map((c) => String(c?.name ?? "").trim())
        .filter(Boolean),
    ),
  ];
  return {
    tenant_id: tenantId,
    connection_id: connectionId,
    woo_id: product.id,
    parent_woo_id: null,
    variation_attributes: {},
    name: product.name,
    sku: product.sku || null,
    price_cents: priceToCents(product.price),
    stock_quantity: product.stock_quantity,
    image_url: product.images?.[0]?.src ?? null,
    woo_categories: categories,
    status: product.status === "publish" ? "active" : product.status,
    source: "woocommerce",
    synced_at: new Date().toISOString(),
  };
}

function mapVariation(tenantId, connectionId, parent, variation) {
  const attributes = {};
  for (const attr of variation.attributes ?? []) {
    const key = attr.name?.trim();
    const value = attr.option?.trim();
    if (key && value) attributes[key] = value;
  }
  const attrSuffix = Object.values(attributes).filter(Boolean).join(" / ");
  const derivedName = attrSuffix ? `${parent.name} — ${attrSuffix}` : parent.name;
  const rawVarName =
    typeof variation.name === "string" && variation.name.trim()
      ? variation.name.trim()
      : "";
  const parentNameTrim = parent.name?.trim() ?? "";
  let finalName;
  if (!rawVarName) finalName = derivedName;
  else if (
    parentNameTrim &&
    !rawVarName.toLowerCase().includes(parentNameTrim.toLowerCase())
  ) {
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
    image_url: variation.image?.src ?? parent.images?.[0]?.src ?? null,
    woo_categories: mapProduct(tenantId, connectionId, parent).woo_categories,
    status:
      (variation.status ?? parent.status) === "publish"
        ? "active"
        : (variation.status ?? parent.status),
    source: "woocommerce",
    synced_at: new Date().toISOString(),
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  console.error(
    "Usage: node --env-file=.env.local scripts/run-woo-catalog-sync.mjs <tenant-slug>",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tenant, error: tenantError } = await admin
  .from("tenants")
  .select("id, name, slug")
  .eq("slug", slug)
  .maybeSingle();
if (tenantError) throw tenantError;
if (!tenant) {
  console.error("Tenant not found:", slug);
  process.exit(1);
}

const { data: connection, error: connError } = await admin
  .from("connections")
  .select("id, credentials")
  .eq("scope_type", "tenant")
  .eq("scope_id", tenant.id)
  .eq("provider", "woocommerce")
  .eq("status", "connected")
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (connError) throw connError;
if (!connection?.credentials?.enc_anon && !connection?.credentials?.enc) {
  console.error("No Woo credentials for tenant");
  process.exit(1);
}

const creds = connection.credentials.enc_anon
  ? decryptEnc(
      connection.credentials.enc_anon,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  : decryptEnc(connection.credentials.enc, serviceKey);

const base = String(creds.url).replace(/\/+$/, "") + "/wp-json/wc/v3";
const auth =
  "Basic " +
  Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

async function wooGet(path, query) {
  const target = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    target.searchParams.set(k, String(v));
  }
  const res = await fetch(target, {
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WooCommerce ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

console.log("Syncing Woo catalog for", tenant.name, tenant.id);
let syncedCount = 0;

for (let page = 1; page <= 50; page++) {
  const products = await wooGet("/products", {
    page,
    per_page: 50,
    orderby: "modified",
    order: "desc",
  });
  if (!Array.isArray(products) || products.length === 0) break;

  const rows = products.map((p) => mapProduct(tenant.id, connection.id, p));
  const { error } = await admin
    .from("inst_products")
    .upsert(rows, { onConflict: "tenant_id,connection_id,woo_id" });
  if (error) throw new Error(error.message);
  syncedCount += rows.length;

  const variableProducts = products.filter(
    (p) =>
      p.type === "variable" &&
      Array.isArray(p.variations) &&
      p.variations.length > 0,
  );
  for (const parent of variableProducts) {
    try {
      const variations = [];
      for (let vPage = 1; vPage <= 5; vPage++) {
        const batch = await wooGet(`/products/${parent.id}/variations`, {
          page: vPage,
          per_page: 100,
        });
        variations.push(...batch);
        if (batch.length < 100) break;
      }
      if (variations.length === 0) continue;
      const vRows = variations.map((v) =>
        mapVariation(tenant.id, connection.id, parent, v),
      );
      const { error: vError } = await admin
        .from("inst_products")
        .upsert(vRows, { onConflict: "tenant_id,connection_id,woo_id" });
      if (vError) throw new Error(vError.message);
      syncedCount += vRows.length;
    } catch (err) {
      console.error("variations failed", parent.id, err.message);
    }
  }

  console.log("page", page, "running total", syncedCount);
  if (products.length < 50) break;
}

console.log({ syncedCount, shopsCount: 1 });
