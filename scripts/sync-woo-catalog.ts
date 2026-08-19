#!/usr/bin/env npx tsx
/**
 * One-off / ops: pull the Woo catalog for a tenant into inst_products.
 *   npx tsx --env-file=.env.local scripts/sync-woo-catalog.ts escale-des-sens
 */
import { createServiceClient } from "../src/lib/supabase/service";
import { syncWooCatalogForTenant } from "../src/lib/woocommerce/catalog-sync";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/sync-woo-catalog.ts <tenant-slug>");
  process.exit(1);
}

const admin = createServiceClient();
const { data: tenant, error } = await admin
  .from("tenants")
  .select("id, name, slug")
  .eq("slug", slug)
  .maybeSingle();
if (error) throw error;
if (!tenant) {
  console.error("Tenant not found:", slug);
  process.exit(1);
}

console.log("Syncing Woo catalog for", tenant.name, tenant.id);
const result = await syncWooCatalogForTenant(tenant.id, admin, admin);
console.log(result);
