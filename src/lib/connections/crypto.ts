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
 * 2. SHA-256(SUPABASE_SERVICE_ROLE_KEY) — toujours dispo en prod Node
 *
 * On chiffre avec la clé dérivée du service role dès qu'elle existe, pour que
 * Vercel puisse lire les blobs même si CONNECTIONS_ENCRYPTION_KEY n'y est pas.
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

function candidateKeys(): Buffer[] {
  const out: Buffer[] = [];
  const seen = new Set<string>();
  const envKey = envFileKey();
  if (envKey) addKey(out, seen, envKey);
  const derived = serviceRoleKey();
  if (derived) addKey(out, seen, derived);
  return out;
}

function encryptKey(): Buffer {
  const derived = serviceRoleKey();
  if (derived) return derived;
  const envKey = envFileKey();
  if (envKey) return envKey;
  throw new Error(
    "Aucune clé de chiffrement (CONNECTIONS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY).",
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
      "Aucune clé de chiffrement (CONNECTIONS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY).",
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

/** Chiffre un objet de credentials en un seul blob. */
export function encryptCredentials(creds: Record<string, unknown>): {
  enc: string;
} {
  return { enc: encryptSecret(JSON.stringify(creds)) };
}

export function decryptCredentials<T = Record<string, unknown>>(stored: {
  enc?: string;
}): T | null {
  if (!stored?.enc) return null;
  return JSON.parse(decryptSecret(stored.enc)) as T;
}
