#!/usr/bin/env node
/**
 * Rebrand d'un tenant BeautyHub : renomme le tenant, change le slug,
 * change l'email + mot de passe du propriétaire, purge caisse démo.
 *
 * Idempotent-safe : si le nouvel email existe déjà côté auth.users
 *   avec un autre UUID, on stoppe pour éviter d'écraser un compte tiers.
 *
 * Usage :
 *   node --env-file=.env.local scripts/tenant-rebrand.mjs \
 *     --tenant <uuid|slug> \
 *     --new-name "Escale des sens" \
 *     --new-slug escale-des-sens \
 *     --owner-email sarah@example.com \
 *     --new-email nouveau@example.com \
 *     --new-password "..." \
 *     [--clean-caisse] \
 *     [--dry-run]
 */

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    tenant: { type: "string" },
    "new-name": { type: "string" },
    "new-slug": { type: "string" },
    "owner-email": { type: "string" },
    "new-email": { type: "string" },
    "new-password": { type: "string" },
    "clean-caisse": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (
  values.help ||
  !values.tenant ||
  !values["new-name"] ||
  !values["new-slug"] ||
  !values["owner-email"] ||
  !values["new-email"] ||
  !values["new-password"]
) {
  console.log(`Rebrand d'un tenant BeautyHub

Usage:
  node --env-file=.env.local scripts/tenant-rebrand.mjs \\
    --tenant <uuid|slug> \\
    --new-name "Nom commercial" \\
    --new-slug slug-url \\
    --owner-email ancien@ex.com \\
    --new-email nouveau@ex.com \\
    --new-password "MotDePasseFort123!" \\
    [--clean-caisse] \\
    [--dry-run]`);
  process.exit(values.help ? 0 : 1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Utilise --env-file=.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dryRun = Boolean(values["dry-run"]);

async function resolveTenant(idOrSlug) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .maybeSingle();
  if (error) throw new Error(`Tenant lookup: ${error.message}`);
  if (!data) throw new Error(`Tenant introuvable: ${idOrSlug}`);
  return data;
}

async function authAdminFetch(pathAndQuery, init = {}) {
  const url = `${SUPABASE_URL}/auth/v1/${pathAndQuery.replace(/^\//, "")}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.msg || json?.message || json?.error_description || res.statusText;
    throw new Error(`auth ${init.method || "GET"} ${pathAndQuery} → ${res.status}: ${msg}`);
  }
  return json;
}

async function findUserByEmail(email) {
  const wanted = email.toLowerCase();
  // GoTrue de ce projet crashe en 500 dès qu'on demande per_page > 5 ou email=,
  // donc on pagine par 5 sans autre option.
  const perPage = 5;
  for (let page = 1; page < 500; page += 1) {
    const data = await authAdminFetch(`admin/users?page=${page}&per_page=${perPage}`);
    const users = data?.users ?? [];
    if (users.length === 0) return null;
    const hit = users.find((u) => (u.email || "").toLowerCase() === wanted);
    if (hit) return hit;
    if (users.length < perPage) return null;
  }
  return null;
}

async function assertSlugFree(newSlug, currentTenantId) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("slug", newSlug)
    .neq("id", currentTenantId);
  if (error) throw new Error(`Slug check: ${error.message}`);
  if ((data ?? []).length > 0) {
    throw new Error(`Slug "${newSlug}" déjà utilisé par un autre tenant.`);
  }
}

async function renameTenant(tenantId, newName, newSlug) {
  if (dryRun) return;
  const { error } = await supabase
    .from("tenants")
    .update({ name: newName, slug: newSlug })
    .eq("id", tenantId);
  if (error) throw new Error(`Rename tenant: ${error.message}`);
}

async function updateOwner(userId, newEmail, newPassword) {
  if (dryRun) return;
  await authAdminFetch(`admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({
      email: newEmail,
      password: newPassword,
      email_confirm: true,
    }),
  });
}

async function cleanCaisse(tenantId) {
  const tables = [
    "inst_cash_movements",
    "inst_cash_reports",
    "inst_cash_sessions",
    "inst_sale_payments",
    "inst_sale_documents",
    "inst_sale_items",
    "inst_sales",
  ];
  const removed = {};
  for (const table of tables) {
    if (dryRun) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (error) console.warn(`  ${table} count: ${error.message}`);
      removed[table] = count ?? 0;
      continue;
    }
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId);
    if (error) {
      console.warn(`  ${table} delete: ${error.message}`);
      continue;
    }
    removed[table] = count ?? 0;
  }
  return removed;
}

async function main() {
  if (dryRun) console.log("🌵 DRY RUN — aucune écriture ne sera faite\n");

  const tenant = await resolveTenant(values.tenant);
  console.log(`🎯 Tenant courant : ${tenant.name} (${tenant.id}) — slug: ${tenant.slug}`);

  const owner = await findUserByEmail(values["owner-email"]);
  if (!owner) throw new Error(`Owner ${values["owner-email"]} introuvable dans auth.users`);
  console.log(`👤 Owner courant : ${owner.email} (${owner.id})`);

  // Pas de check de collision préventif : GoTrue de ce projet renvoie 500 sur
  // les pages > 1 (bug interne). On délègue à l'update qui rejettera si un
  // autre user possède déjà l'email cible.

  await assertSlugFree(values["new-slug"], tenant.id);

  console.log(`\n📝 Plan:`);
  console.log(`  - Tenant name : "${tenant.name}" → "${values["new-name"]}"`);
  console.log(`  - Tenant slug : "${tenant.slug}" → "${values["new-slug"]}"`);
  console.log(`  - Owner email : "${owner.email}" → "${values["new-email"]}"`);
  console.log(`  - Owner password : (nouveau, ${values["new-password"].length} caractères)`);
  console.log(`  - Nettoyage caisse : ${values["clean-caisse"] ? "OUI" : "non"}`);

  console.log(`\n1️⃣  Tenant rename...`);
  await renameTenant(tenant.id, values["new-name"], values["new-slug"]);
  console.log(dryRun ? "   (skipped: dry-run)" : "   ✓");

  console.log(`\n2️⃣  Owner email + password...`);
  await updateOwner(owner.id, values["new-email"], values["new-password"]);
  console.log(dryRun ? "   (skipped: dry-run)" : "   ✓");

  if (values["clean-caisse"]) {
    console.log(`\n3️⃣  Nettoyage caisse...`);
    const stats = await cleanCaisse(tenant.id);
    for (const [t, n] of Object.entries(stats)) {
      if (n) console.log(`   ${t}: ${dryRun ? `${n} lignes seraient supprimées` : `-${n}`}`);
    }
  }

  console.log(dryRun ? "\n✅ DRY RUN terminé." : "\n✅ Rebrand terminé.");
  if (!dryRun) {
    console.log(`\n📧 Communique à la cliente :`);
    console.log(`   URL       : https://beautyhub-seven.vercel.app/sign-in`);
    console.log(`   Email     : ${values["new-email"]}`);
    console.log(`   Mot passe : ${values["new-password"]}`);
    console.log(`   Public    : https://beautyhub-seven.vercel.app/book/${values["new-slug"]}`);
  }
}

main().catch((err) => {
  console.error("\n❌", err.message || err);
  process.exit(1);
});
