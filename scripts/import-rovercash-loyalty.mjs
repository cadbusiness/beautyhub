#!/usr/bin/env node
/**
 * Reprise des soldes fidélité Rovercash → bon euros BeautyHub.
 *
 * Ancien système : 1 point = 1 € dépensé, 500 € → 17,50 € (3,5 %).
 * BeautyHub (bon euros) : 1 point = 1 centime, donc
 *   crédit_centimes = floor(points_csv * 100 * 350 / 10_000)
 *                   = floor(points_csv * 3,5)
 *
 * Prérequis : .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-rovercash-loyalty.mjs \
 *     --tenant escale-des-sens \
 *     --file /path/to/clients_fidelite.csv \
 *     [--dry-run]
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const RATE_BPS = 350;
const IMPORT_KEY_PREFIX = "rovercash-import-v1:";
const IMPORT_NOTES = "Reprise Rovercash · 3,5 % (500 € → 17,50 €)";

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
  console.log(`Reprise fidélité Rovercash → bon euros

Usage:
  node --env-file=.env.local scripts/import-rovercash-loyalty.mjs \\
    --tenant escale-des-sens \\
    --file /path/to/clients_fidelite.csv \\
    [--dry-run]
`);
  process.exit(values.help ? 0 : 1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants. Lance avec --env-file=.env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function creditCentsForSpend(amountCents, rateBps) {
  if (amountCents <= 0 || rateBps <= 0) return 0;
  return Math.floor((amountCents * rateBps) / 10_000);
}

function parseCsv(raw) {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",").map((h) => h.trim());
  const refIdx = header.indexOf("ref_contact");
  const ptsIdx = header.indexOf("points");
  if (refIdx < 0 || ptsIdx < 0) {
    throw new Error("CSV invalide : colonnes ref_contact et points requises");
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const ref = (cols[refIdx] ?? "").trim();
    const pts = Number.parseInt((cols[ptsIdx] ?? "").trim(), 10);
    if (!ref) continue;
    rows.push({ ref, spendPoints: Number.isFinite(pts) ? pts : 0 });
  }
  return rows;
}

async function resolveTenant(slugOrId) {
  const raw = slugOrId.trim();
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, slug, name")
      .eq("id", raw)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", raw)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchRovercashClients(tenantId) {
  const byRef = new Map();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, metadata")
      .eq("tenant_id", tenantId)
      .eq("source", "rovercash")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const ref =
        row.metadata && typeof row.metadata === "object"
          ? String(row.metadata.rovercash_ref ?? "").trim()
          : "";
      if (ref) byRef.set(ref, { id: row.id, name: row.full_name });
    }
    if (rows.length < pageSize) break;
  }
  return byRef;
}

async function alignProgram(tenantId, dryRun) {
  const { data: program, error } = await supabase
    .from("inst_loyalty_programs")
    .select("id, name, credit_enabled, credit_rate_bps")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!program) throw new Error("Aucun programme fidélité actif");

  if (!dryRun) {
    const { error: updErr } = await supabase
      .from("inst_loyalty_programs")
      .update({
        credit_enabled: true,
        credit_rate_bps: RATE_BPS,
        points_label: "€",
      })
      .eq("id", program.id)
      .eq("tenant_id", tenantId);
    if (updErr) throw new Error(updErr.message);

    await supabase
      .from("inst_loyalty_earn_rules")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id);

    await supabase
      .from("inst_loyalty_rewards")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .eq("program_id", program.id);
  }

  return program;
}

const csvRows = parseCsv(fs.readFileSync(values.file, "utf8"));
const tenant = await resolveTenant(values.tenant);
if (!tenant) {
  console.error(`Tenant introuvable: ${values.tenant}`);
  process.exit(1);
}

const dryRun = Boolean(values["dry-run"]);
const program = await alignProgram(tenant.id, dryRun);
const clients = await fetchRovercashClients(tenant.id);

const matched = [];
const unmatched = [];
const skipped = [];
for (const row of csvRows) {
  if (row.spendPoints <= 0) {
    skipped.push(row);
    continue;
  }
  const client = clients.get(row.ref);
  const creditCents = creditCentsForSpend(row.spendPoints * 100, RATE_BPS);
  if (creditCents <= 0) {
    skipped.push(row);
    continue;
  }
  if (!client) {
    unmatched.push({ ...row, creditCents });
    continue;
  }
  matched.push({ ...row, creditCents, client });
}

const totalCredit = matched.reduce((s, r) => s + r.creditCents, 0);
console.log(
  `${tenant.name} · ${dryRun ? "dry-run" : "import"} · 3,5 % (500 € → 17,50 €)`,
);
console.log(
  `CSV ${csvRows.length} · match ${matched.length} · sans fiche ${unmatched.length} · ignorés (0/−) ${skipped.length}`,
);
console.log(
  `Crédit total à poser : ${(totalCredit / 100).toFixed(2)} €`,
);
const examples = matched
  .slice()
  .sort((a, b) => b.spendPoints - a.spendPoints)
  .slice(0, 5);
for (const row of examples) {
  console.log(
    `  ${row.ref} ${row.client.name} · ${row.spendPoints} € dépensés → ${(row.creditCents / 100).toFixed(2)} €`,
  );
}
if (unmatched.length) {
  console.log(`Ex. non trouvés : ${unmatched.slice(0, 8).map((r) => r.ref).join(", ")}`);
}

if (dryRun) {
  console.log("Rien écrit (--dry-run).");
  process.exit(0);
}

let credited = 0;
let already = 0;
let failed = 0;
const chunkSize = 25;
for (let i = 0; i < matched.length; i += chunkSize) {
  const chunk = matched.slice(i, i + chunkSize);
  const results = await Promise.all(
    chunk.map(async (row) => {
      let lastError = "unknown";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, error } = await supabase.rpc("inst_loyalty_credit_bonus", {
            p_tenant_id: tenant.id,
            p_client_id: row.client.id,
            p_program_id: program.id,
            p_points: row.creditCents,
            p_source_type: "pos_sale",
            p_source_id: row.client.id,
            p_idempotency_key: `${IMPORT_KEY_PREFIX}${row.ref}`,
            p_notes: IMPORT_NOTES,
          });
          if (error) {
            lastError = error.message;
          } else {
            return { ok: true, applied: data === true, ref: row.ref };
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      return { ok: false, error: lastError, ref: row.ref };
    }),
  );
  for (const result of results) {
    if (!result.ok) {
      failed += 1;
      console.error(`  échec ${result.ref}: ${result.error}`);
    } else if (result.applied) {
      credited += 1;
    } else {
      already += 1;
    }
  }
  process.stdout.write(
    `\r  ${Math.min(i + chunk.length, matched.length)}/${matched.length}`,
  );
}

console.log(
  `\nTerminé · crédités ${credited} · déjà importés ${already} · échecs ${failed}`,
);
if (failed) process.exit(1);
