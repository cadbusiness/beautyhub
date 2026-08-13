#!/usr/bin/env node
/**
 * Import direct d'un export Bookly (JSON complet) dans un tenant BeautyHub.
 *
 * Prérequis:
 *   - .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Le tenant BeautyHub cible doit déjà exister (SLUG ou UUID)
 *   - Le JSON est celui produit par le plugin WP "Export Bookly BeautyHub"
 *     (fichier bookly-services-extras.json)
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-bookly-json.mjs \
 *     --tenant <uuid|slug> \
 *     --file /path/to/bookly-services-extras.json \
 *     [--dry-run]
 *
 * Idempotent:
 *   - Catégories matchées par bookly_id (fallback name)
 *   - Services matchés par bookly_id
 *   - Extras créés comme inst_services (visibility=extra_only) dédupliqués par nom
 *   - Liens inst_service_extras upsert (service_id, extra_service_id)
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    tenant: { type: "string" },
    file: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

if (values.help || !values.tenant || !values.file) {
  console.log(`Import Bookly JSON → BeautyHub

Usage:
  node --env-file=.env.local scripts/import-bookly-json.mjs \\
    --tenant <uuid|slug> \\
    --file /path/to/bookly-services-extras.json \\
    [--dry-run]

Options:
  --tenant   UUID du tenant OU slug (ex: "salon-marie")
  --file     Chemin vers bookly-services-extras.json
  --dry-run  N'écrit rien, affiche seulement le plan
`);
  process.exit(values.help ? 0 : 1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants. Lance avec --env-file=.env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const filePath = path.resolve(values.file);
if (!fs.existsSync(filePath)) {
  console.error(`❌ Fichier introuvable: ${filePath}`);
  process.exit(1);
}

/** @type {{ services: any[]; extras: any[]; categories: any[]; counts?: any }} */
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
console.log(
  `📦 Fichier: ${payload.counts?.services ?? payload.services.length} services · ${
    payload.counts?.extras ?? payload.extras.length
  } extras · ${payload.categories.length} catégories`,
);

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

async function fetchExistingCatalog(tenantId) {
  const [{ data: categories, error: e1 }, { data: services, error: e2 }, { data: links, error: e3 }] =
    await Promise.all([
      supabase.from("inst_service_categories").select("id, name, bookly_id").eq("tenant_id", tenantId),
      supabase
        .from("inst_services")
        .select("id, name, bookly_id, visibility")
        .eq("tenant_id", tenantId),
      supabase
        .from("inst_service_extras")
        .select("service_id, extra_service_id")
        .eq("tenant_id", tenantId),
    ]);
  if (e1) throw new Error(`categories: ${e1.message}`);
  if (e2) throw new Error(`services: ${e2.message}`);
  if (e3) throw new Error(`links: ${e3.message}`);
  return { categories: categories ?? [], services: services ?? [], links: links ?? [] };
}

async function upsertCategories(tenantId, existing, dryRun) {
  const byBookly = new Map(existing.filter((c) => c.bookly_id != null).map((c) => [c.bookly_id, c]));
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));
  const idByBooklyId = new Map();
  let created = 0;
  let updated = 0;

  const sorted = [...payload.categories].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  for (let i = 0; i < sorted.length; i += 1) {
    const cat = sorted[i];
    const name = (cat.name || `Catégorie ${cat.id}`).trim();
    if (!name) continue;
    const existingCat = byBookly.get(cat.id) ?? byName.get(name.toLowerCase());

    if (existingCat) {
      if (!dryRun) {
        const { error } = await supabase
          .from("inst_service_categories")
          .update({ name, bookly_id: cat.id, sort_order: cat.id ?? i })
          .eq("id", existingCat.id);
        if (error) console.warn(`  cat "${name}" update: ${error.message}`);
      }
      idByBooklyId.set(cat.id, existingCat.id);
      updated += 1;
    } else {
      if (dryRun) {
        idByBooklyId.set(cat.id, `dry:${cat.id}`);
      } else {
        const { data, error } = await supabase
          .from("inst_service_categories")
          .insert({ tenant_id: tenantId, name, bookly_id: cat.id, sort_order: cat.id ?? i })
          .select("id")
          .single();
        if (error || !data) {
          console.warn(`  cat "${name}" insert: ${error?.message}`);
          continue;
        }
        idByBooklyId.set(cat.id, data.id);
      }
      created += 1;
    }
  }
  console.log(`  Catégories: +${created} créées, ${updated} mises à jour`);
  return idByBooklyId;
}

async function upsertServices(tenantId, existing, catIdByBooklyId, dryRun) {
  const byBookly = new Map(existing.filter((s) => s.bookly_id != null).map((s) => [s.bookly_id, s]));
  const idByBookly = new Map();
  let created = 0;
  let updated = 0;
  let seen = new Set();

  for (const s of payload.services) {
    const booklyId = Number(s.id);
    if (!booklyId || seen.has(booklyId)) continue;
    seen.add(booklyId);

    const name = (s.title || "").trim();
    if (!name) continue;

    const categoryId = s.category_id ? (catIdByBooklyId.get(s.category_id) ?? null) : null;
    const description = (s.info || "").trim() || null;
    const priceCents = Number(s.price_cents) || 0;
    const durationMin = Math.max(1, Math.round((Number(s.duration_sec) || 0) / 60) || Number(s.duration_min) || 0);
    const bufferBefore = Math.max(0, Math.round((Number(s.padding_left_sec) || 0) / 60));
    const bufferAfter = Math.max(0, Math.round((Number(s.padding_right_sec) || 0) / 60));
    const color = (s.color || "").trim() || null;
    const visibility = String(s.visibility || "public") === "private" ? "extra_only" : "catalog";
    const isActive = String(s.visibility || "public") !== "archived";

    const payloadDb = {
      name,
      description,
      duration_min: durationMin || 15,
      price_cents: priceCents,
      color,
      visibility,
      is_active: isActive,
      buffer_before_min: bufferBefore,
      buffer_after_min: bufferAfter,
      category_id: categoryId,
      sort_order: Number(s.position) || 0,
      bookly_id: booklyId,
    };

    const found = byBookly.get(booklyId);
    if (found) {
      if (!dryRun) {
        const { error } = await supabase.from("inst_services").update(payloadDb).eq("id", found.id);
        if (error) console.warn(`  svc "${name}" update: ${error.message}`);
      }
      idByBookly.set(booklyId, found.id);
      updated += 1;
    } else {
      if (dryRun) {
        idByBookly.set(booklyId, `dry:${booklyId}`);
      } else {
        const { data, error } = await supabase
          .from("inst_services")
          .insert({ tenant_id: tenantId, ...payloadDb })
          .select("id")
          .single();
        if (error || !data) {
          console.warn(`  svc "${name}" insert: ${error?.message}`);
          continue;
        }
        idByBookly.set(booklyId, data.id);
      }
      created += 1;
    }
  }
  console.log(`  Services: +${created} créés, ${updated} mis à jour`);
  return idByBookly;
}

async function upsertExtras(tenantId, existing, serviceIdByBookly, dryRun) {
  const extrasByName = new Map(
    existing.services.filter((s) => s.visibility === "extra_only").map((s) => [s.name.trim().toLowerCase(), s]),
  );
  const existingLinks = new Set(existing.links.map((l) => `${l.service_id}:${l.extra_service_id}`));

  const uniqueExtras = new Map();
  for (const e of payload.extras) {
    const name = (e.title || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!uniqueExtras.has(key)) uniqueExtras.set(key, e);
  }

  const extraIdByName = new Map();
  let extrasCreated = 0;
  let extrasReused = 0;

  for (const [key, e] of uniqueExtras) {
    const found = extrasByName.get(key);
    if (found) {
      extraIdByName.set(key, found.id);
      extrasReused += 1;
      continue;
    }
    const durationMin = Math.max(
      1,
      Math.round((Number(e.duration_sec) || 0) / 60) || Number(e.duration_min) || 1,
    );
    const priceCents = Number(e.price_cents) || 0;
    if (dryRun) {
      extraIdByName.set(key, `dry:${key}`);
    } else {
      const { data, error } = await supabase
        .from("inst_services")
        .insert({
          tenant_id: tenantId,
          name: e.title,
          duration_min: durationMin,
          price_cents: priceCents,
          visibility: "extra_only",
          is_active: true,
          sort_order: Number(e.position) || 0,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.warn(`  extra "${e.title}" insert: ${error?.message}`);
        continue;
      }
      extraIdByName.set(key, data.id);
    }
    extrasCreated += 1;
  }

  let linksCreated = 0;
  let linksUpdated = 0;
  let linksSkipped = 0;

  for (const e of payload.extras) {
    const name = (e.title || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const extraId = extraIdByName.get(key);
    const parentId = serviceIdByBookly.get(Number(e.service_id));
    if (!extraId || !parentId || extraId === parentId) {
      linksSkipped += 1;
      continue;
    }

    const linkPayload = {
      tenant_id: tenantId,
      service_id: parentId,
      extra_service_id: extraId,
      min_qty: Math.max(0, Number(e.min_quantity) || 0),
      max_qty: Math.max(1, Number(e.max_quantity) || 1),
      sort_order: Number(e.position) || 0,
    };

    const linkKey = `${parentId}:${extraId}`;
    if (existingLinks.has(linkKey)) {
      if (!dryRun) {
        const { error } = await supabase
          .from("inst_service_extras")
          .update({
            min_qty: linkPayload.min_qty,
            max_qty: linkPayload.max_qty,
            sort_order: linkPayload.sort_order,
          })
          .eq("service_id", parentId)
          .eq("extra_service_id", extraId);
        if (error) console.warn(`  link "${name}" update: ${error.message}`);
      }
      linksUpdated += 1;
    } else {
      if (!dryRun) {
        const { error } = await supabase.from("inst_service_extras").insert(linkPayload);
        if (error) {
          console.warn(`  link "${name}" insert: ${error.message}`);
          continue;
        }
      }
      existingLinks.add(linkKey);
      linksCreated += 1;
    }
  }
  console.log(
    `  Extras: +${extrasCreated} créés, ${extrasReused} réutilisés · Liens: +${linksCreated} créés, ${linksUpdated} mis à jour, ${linksSkipped} ignorés (sans service mère)`,
  );
}

async function main() {
  const dryRun = Boolean(values["dry-run"]);
  if (dryRun) console.log("🌵 DRY RUN — aucune écriture ne sera faite\n");

  const tenant = await resolveTenant(values.tenant);
  console.log(`🎯 Tenant: ${tenant.name} (${tenant.id})\n`);

  const existing = await fetchExistingCatalog(tenant.id);
  console.log(
    `📥 État actuel: ${existing.services.length} services (dont ${
      existing.services.filter((s) => s.visibility === "extra_only").length
    } extras) · ${existing.categories.length} catégories · ${existing.links.length} liens\n`,
  );

  console.log("1️⃣  Catégories...");
  const catIds = await upsertCategories(tenant.id, existing.categories, dryRun);

  console.log("\n2️⃣  Services...");
  const svcIds = await upsertServices(tenant.id, existing.services, catIds, dryRun);

  console.log("\n3️⃣  Extras + liens...");
  await upsertExtras(tenant.id, existing, svcIds, dryRun);

  console.log(dryRun ? "\n✅ DRY RUN terminé." : "\n✅ Import terminé.");
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err.message || err);
  process.exit(1);
});
