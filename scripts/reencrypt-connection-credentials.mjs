#!/usr/bin/env node
/**
 * Re-encrypts connections.credentials so production can decrypt them with
 * SHA-256(SUPABASE_SERVICE_ROLE_KEY) when CONNECTIONS_ENCRYPTION_KEY is missing.
 *
 *   node scripts/reencrypt-connection-credentials.mjs
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function legacyJwtAnon() {
  const fromEnv = process.env.SUPABASE_ANON_KEY?.trim();
  if (fromEnv && fromEnv !== anonKey) return fromEnv;
  try {
    const raw = execSync(
      "supabase projects api-keys --project-ref cmlnlwqjnqplsfemrvsp -o json",
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const keys = JSON.parse(raw);
    const jwt = keys.find(
      (item) =>
        (item.name === "anon" || item.id === "anon") &&
        typeof (item.api_key || item.key) === "string" &&
        String(item.api_key || item.key).startsWith("eyJ"),
    );
    const value = jwt?.api_key || jwt?.key;
    return typeof value === "string" && value !== anonKey ? value : null;
  } catch {
    return null;
  }
}

const jwtAnon = legacyJwtAnon();

function keys() {
  const out = [];
  const raw = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length === 32) out.push(key);
  }
  out.push(createHash("sha256").update(serviceKey).digest());
  if (anonKey) out.push(createHash("sha256").update(anonKey).digest());
  return out;
}

function decryptEnc(enc) {
  const buf = Buffer.from(enc, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  let last;
  for (const key of keys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

function encryptWith(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function encryptEnc(plaintext) {
  return encryptWith(plaintext, createHash("sha256").update(serviceKey).digest());
}

function encryptAnon(plaintext) {
  if (!anonKey) return null;
  return encryptWith(plaintext, createHash("sha256").update(anonKey).digest());
}

function encryptJwt(plaintext) {
  if (!jwtAnon) return null;
  return encryptWith(plaintext, createHash("sha256").update(jwtAnon).digest());
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("connections")
  .select("id, provider, credentials")
  .not("credentials", "is", null);
if (error) throw error;

let updated = 0;
let skipped = 0;
let failed = 0;

for (const row of data ?? []) {
  const creds = row.credentials;
  if (!creds || typeof creds !== "object" || typeof creds.enc !== "string") {
    skipped += 1;
    continue;
  }
  try {
    const plaintext = decryptEnc(creds.enc);
    JSON.parse(plaintext);
    const nextEnc = encryptEnc(plaintext);
    const nextAnon = encryptAnon(plaintext);
    const nextJwt = encryptJwt(plaintext);
    if (
      nextEnc === creds.enc &&
      nextAnon &&
      creds.enc_anon === nextAnon &&
      (!nextJwt || creds.enc_jwt === nextJwt)
    ) {
      skipped += 1;
      continue;
    }
    const nextCredentials = { enc: nextEnc };
    if (nextAnon) nextCredentials.enc_anon = nextAnon;
    if (nextJwt) nextCredentials.enc_jwt = nextJwt;
    const { error: updateError } = await supabase
      .from("connections")
      .update({ credentials: nextCredentials })
      .eq("id", row.id);
    if (updateError) throw updateError;
    updated += 1;
    console.log("re-encrypted", row.provider, row.id);
  } catch (err) {
    failed += 1;
    console.error("failed", row.id, err.message);
  }
}

console.log({ updated, skipped, failed, total: data?.length ?? 0 });
