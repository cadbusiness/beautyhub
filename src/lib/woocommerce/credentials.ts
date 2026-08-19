import { decryptCredentials } from "@/lib/connections/crypto";
import type { WooCredentials } from "./client";

function readPlainWooCredentials(
  stored: Record<string, unknown>,
): WooCredentials | null {
  const url = String(stored.url ?? stored.shopUrl ?? stored.shop_url ?? "").trim();
  const consumerKey = String(
    stored.consumerKey ?? stored.consumer_key ?? stored.key ?? "",
  ).trim();
  const consumerSecret = String(
    stored.consumerSecret ?? stored.consumer_secret ?? stored.secret ?? "",
  ).trim();
  if (!url || !consumerKey || !consumerSecret) return null;
  return { url, consumerKey, consumerSecret };
}

/**
 * Credentials Woo : blob `{ enc }` / `{ enc_anon }` (pairing actuel) ou objet en clair
 * (`consumerKey` / `consumer_key`).
 */
export function parseStoredWooCredentials(raw: unknown): WooCredentials | null {
  let input: unknown = raw;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      input = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!input || typeof input !== "object") return null;
  const stored = input as Record<string, unknown>;
  const fallback = readPlainWooCredentials(stored);

  const hasEnc =
    (typeof stored.enc === "string" && stored.enc.length > 0) ||
    (typeof stored.enc_anon === "string" && stored.enc_anon.length > 0);
  if (hasEnc) {
    try {
      const decrypted = decryptCredentials(stored) as Record<
        string,
        unknown
      > | null;
      const fromEnc = decrypted ? readPlainWooCredentials(decrypted) : null;
      if (fromEnc) return fromEnc;
    } catch (error) {
      console.error("[woo] decrypt credentials failed", (error as Error).message);
    }
  }

  return fallback;
}
