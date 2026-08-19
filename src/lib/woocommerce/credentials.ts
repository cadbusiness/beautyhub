import { decryptCredentials } from "@/lib/connections/crypto";
import type { WooCredentials } from "./client";

/**
 * Credentials Woo : blob `{ enc }` (pairing actuel) ou objet en clair
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
  let stored = input as Record<string, unknown>;
  try {
    if (typeof stored.enc === "string" && stored.enc.length > 0) {
      const decrypted = decryptCredentials({ enc: stored.enc }) as Record<
        string,
        unknown
      > | null;
      if (!decrypted) return null;
      stored = decrypted;
    }
  } catch (error) {
    console.error("[woo] decrypt credentials failed", (error as Error).message);
    return null;
  }

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
