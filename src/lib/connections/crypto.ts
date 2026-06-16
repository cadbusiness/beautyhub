import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Chiffrement AES-256-GCM des credentials d'integrations (Stripe/Woo...).
 * La cle vient de CONNECTIONS_ENCRYPTION_KEY (base64, 32 octets).
 * Format stocke: base64(iv[12] | tag[16] | ciphertext).
 */
function getKey(): Buffer {
  const raw = process.env.CONNECTIONS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY manquante.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CONNECTIONS_ENCRYPTION_KEY doit faire 32 octets (base64). Generer: openssl rand -base64 32",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
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
