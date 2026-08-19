import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM des credentials d'integrations (Stripe/Woo...).
 *
 * Clés candidates (dans l'ordre) :
 * 1. CONNECTIONS_ENCRYPTION_KEY (base64, 32 octets) — historique
 * 2. SHA-256(SUPABASE_SERVICE_ROLE_KEY)
 * 3. SHA-256(NEXT_PUBLIC_SUPABASE_ANON_KEY) — toujours présent sur Vercel
 *
 * `enc` est chiffré avec service role / CONNECTIONS_ENCRYPTION_KEY.
 * `enc_anon` est un second blob lisible dès que l'anon key Next est là,
 * même si la service role manque en prod.
 */
function addKey(out: Buffer[], seen: Set<string>, key: Buffer) {
  if (key.length !== 32) return;
  const id = key.toString("hex");
  if (seen.has(id)) return;
  seen.add(id);
  out.push(key);
}

function serviceRoleKey(): Buffer | null {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!sr) return null;
  return createHash("sha256").update(sr).digest();
}

function envFileKey(): Buffer | null {
  const raw = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

function anonDerivedKey(): Buffer | null {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anon) return null;
  return createHash("sha256").update(anon).digest();
}

function candidateKeys(): Buffer[] {
  const out: Buffer[] = [];
  const seen = new Set<string>();
  const envKey = envFileKey();
  if (envKey) addKey(out, seen, envKey);
  const derived = serviceRoleKey();
  if (derived) addKey(out, seen, derived);
  const anon = anonDerivedKey();
  if (anon) addKey(out, seen, anon);

  // Anciennes dérivations vues en local / scripts.
  const rawEnc = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (rawEnc) addKey(out, seen, createHash("sha256").update(rawEnc).digest());
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (sr && sr.length >= 32) addKey(out, seen, Buffer.from(sr.slice(0, 32), "utf8"));
  return out;
}

function encryptKey(): Buffer {
  const derived = serviceRoleKey();
  if (derived) return derived;
  const envKey = envFileKey();
  if (envKey) return envKey;
  const anon = anonDerivedKey();
  if (anon) return anon;
  throw new Error(
    "Aucune clé de chiffrement (CONNECTIONS_ENCRYPTION_KEY, SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  );
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptWithKey(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSecret(plaintext: string): string {
  return encryptWithKey(plaintext, encryptKey());
}

export function decryptSecret(payload: string): string {
  const keys = candidateKeys();
  if (keys.length === 0) {
    throw new Error(
      "Aucune clé de chiffrement (CONNECTIONS_ENCRYPTION_KEY, SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  let lastError: unknown;
  for (const key of keys) {
    try {
      return decryptWithKey(payload, key);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Impossible de déchiffrer le secret.");
}

export type EncryptedCredentials = {
  enc: string;
  enc_anon?: string;
  enc_jwt?: string;
};

/** Chiffre un objet : `enc` (service/env) + `enc_anon` (clé publique Next). */
export function encryptCredentials(
  creds: Record<string, unknown>,
): EncryptedCredentials {
  const json = JSON.stringify(creds);
  const out: EncryptedCredentials = { enc: encryptSecret(json) };
  const anon = anonDerivedKey();
  if (anon) out.enc_anon = encryptWithKey(json, anon);
  return out;
}

export function decryptCredentials<T = Record<string, unknown>>(stored: {
  enc?: string;
  enc_anon?: string;
  enc_jwt?: string;
  [key: string]: unknown;
}): T | null {
  const blobs = Object.entries(stored ?? {})
    .filter(
      ([key, value]) =>
        key.startsWith("enc") && typeof value === "string" && value.length > 0,
    )
    .map(([, value]) => value as string);
  if (blobs.length === 0) return null;
  let lastError: unknown;
  for (const blob of blobs) {
    try {
      return JSON.parse(decryptSecret(blob)) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Impossible de déchiffrer le secret.");
}
