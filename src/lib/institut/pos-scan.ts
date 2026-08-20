export function normalizeScanCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, "");
}

/** EAN-8 / UPC / EAN-13 / ITF-14, or a compact SKU a HID scanner would send. */
export function looksLikeScanCode(raw: string | null | undefined): boolean {
  const code = normalizeScanCode(raw);
  if (code.length < 4 || code.length > 64) return false;
  if (/^[0-9]{6,14}$/.test(code)) return true;
  return /^[A-Za-z0-9._\-\/]+$/.test(code) && /\d/.test(code) && code.length >= 6;
}

export function looksLikeBarcode(raw: string | null | undefined): boolean {
  return /^[0-9]{8,14}$/.test(normalizeScanCode(raw));
}

export function catalogScanCodes(item: {
  sku?: string | null;
  barcode?: string | null;
}): string[] {
  const codes = [item.sku, item.barcode]
    .map((value) => normalizeScanCode(value).toLowerCase())
    .filter(Boolean);
  return [...new Set(codes)];
}

export function findCatalogItemByScanCode<
  T extends { sku?: string | null; barcode?: string | null },
>(items: T[], raw: string): T | null {
  const code = normalizeScanCode(raw).toLowerCase();
  if (!code) return null;
  return items.find((item) => catalogScanCodes(item).includes(code)) ?? null;
}

const WOO_BARCODE_META_KEYS = [
  "_global_unique_id",
  "global_unique_id",
  "_alg_ean",
  "alg_ean",
  "_ean",
  "ean",
  "_barcode",
  "barcode",
  "_gtin",
  "gtin",
  "hwp_product_gtin",
  "_hwp_gtin",
] as const;

function metaString(
  meta: Array<{ key: string; value: unknown }> | undefined,
  key: string,
): string {
  const raw = meta?.find((entry) => entry.key === key)?.value;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

/** GTIN / EAN Woo (champ natif ou plugins), sinon SKU s’il ressemble à un code-barres. */
export function extractWooBarcode(product: {
  sku?: string | null;
  global_unique_id?: string | null;
  meta_data?: Array<{ key: string; value: unknown }>;
}): string | null {
  const candidates = [
    product.global_unique_id,
    ...WOO_BARCODE_META_KEYS.map((key) => metaString(product.meta_data, key)),
    product.sku,
  ];
  for (const candidate of candidates) {
    const code = normalizeScanCode(candidate);
    if (looksLikeBarcode(code)) return code;
  }
  return null;
}
