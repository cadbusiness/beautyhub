import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface PairingPayload {
  tenantId: string;
  shopUrl: string;
  apiUrl: string;
  exp: number;
  nonce: string;
}

function pairingKey(): Buffer {
  const raw = process.env.CONNECTIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONNECTIONS_ENCRYPTION_KEY manquante.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY invalide.");
  }
  return key;
}

export function normalizeShopUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed;
  }
}

export function createPairingToken(input: {
  tenantId: string;
  shopUrl: string;
  apiUrl: string;
  ttlMs?: number;
}): string {
  const payload: PairingPayload = {
    tenantId: input.tenantId,
    shopUrl: normalizeShopUrl(input.shopUrl),
    apiUrl: input.apiUrl.replace(/\/+$/, ""),
    exp: Date.now() + (input.ttlMs ?? 15 * 60 * 1000),
    nonce: randomBytes(12).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", pairingKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPairingToken(token: string): PairingPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", pairingKey()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as PairingPayload;
    if (!payload.tenantId || !payload.shopUrl || !payload.apiUrl || !payload.exp) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildPairingAdminUrl(shopUrl: string, token: string, apiUrl: string): string {
  const base = normalizeShopUrl(shopUrl);
  const params = new URLSearchParams({
    page: "beautyhub-connector",
    beautyhub_pair: token,
    beautyhub_api: apiUrl,
  });
  return `${base}/wp-admin/admin.php?${params.toString()}`;
}
