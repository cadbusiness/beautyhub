#!/usr/bin/env node
/**
 * Cree les comptes equipe de test (Supabase Auth + memberships).
 * Usage: node scripts/seed-test-users.mjs
 * Requiert SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL dans .env.local
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const raw = readFileSync(path, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const PLATFORM_BRAND_ID = "00000000-0000-0000-0000-0000000000b1";
const DEMO_TENANT_ID = "00000000-0000-0000-0000-0000000000d1";
const TEST_PASSWORD = "BeautyHub2026!";

const TEST_USERS = [
  {
    email: "admin@beautyhub.test",
    role: "platform_admin",
    brand_id: null,
    tenant_id: null,
  },
  {
    email: "brand@beautyhub.test",
    role: "brand_owner",
    brand_id: PLATFORM_BRAND_ID,
    tenant_id: null,
  },
  {
    email: "owner@demo.test",
    role: "tenant_owner",
    brand_id: null,
    tenant_id: DEMO_TENANT_ID,
  },
  {
    email: "staff@demo.test",
    role: "staff",
    brand_id: null,
    tenant_id: DEMO_TENANT_ID,
  },
  {
    email: "coach@demo.test",
    role: "coach",
    brand_id: null,
    tenant_id: DEMO_TENANT_ID,
  },
];

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("→ Comptes de test BeautyHub\n");

  for (const account of TEST_USERS) {
    const { data: list } = await supabase.auth.admin.listUsers();
    let userId = list?.users?.find((u) => u.email === account.email)?.id;

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      if (error) {
        console.error(`  ✗ ${account.email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      console.log(`  + Auth: ${account.email}`);
    } else {
      await supabase.auth.admin.updateUserById(userId, {
        password: TEST_PASSWORD,
      });
      console.log(`  ~ Auth: ${account.email} (mis a jour)`);
    }

    const { data: existing } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("role", account.role)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("memberships")
        .update({
          brand_id: account.brand_id,
          tenant_id: account.tenant_id,
        })
        .eq("id", existing.id);
      console.log(`  ~ Membership: ${account.role}`);
    } else {
      const { error: memErr } = await supabase.from("memberships").insert({
        user_id: userId,
        role: account.role,
        brand_id: account.brand_id,
        tenant_id: account.tenant_id,
      });
      if (memErr) {
        console.error(`  ✗ Membership ${account.email}: ${memErr.message}`);
      } else {
        console.log(`  + Membership: ${account.role}`);
      }
    }
  }

  console.log(`\n✅ Mot de passe commun (dev): ${TEST_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
