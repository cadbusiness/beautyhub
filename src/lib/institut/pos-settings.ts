import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { formatPrice } from "@/lib/utils";
import {
  getTaxCountry,
  isVatExemptRegime,
  resolvePosCurrency,
  type PosFiscalRegime,
} from "./tax-catalog";

type Db = SupabaseClient<Database>;

export type { PosFiscalRegime };
export type PosPriceDisplay = "ttc" | "ht";
export type PosPaymentMethodKey =
  | "cash"
  | "card"
  | "transfer"
  | "gift_card"
  | "stripe";

export interface PosPaymentMethodsConfig {
  cash: boolean;
  card: boolean;
  transfer: boolean;
  gift_card: boolean;
  stripe: boolean;
}

export interface PosSettings {
  tenant_id: string;
  country_code: string;
  currency: string;
  price_display: PosPriceDisplay;
  default_vat_rate_bps: number;
  service_vat_rate_bps: number;
  product_vat_rate_bps: number;
  payment_methods: PosPaymentMethodsConfig;
  ticket_header: string | null;
  ticket_footer: string | null;
  legal_name: string | null;
  legal_address: string | null;
  vat_number: string | null;
  siret: string | null;
  ticket_prefix: string;
  fiscal_regime: PosFiscalRegime;
  require_open_session: boolean;
  default_opening_float_cents: number;
  credit_note_prefix: string;
  gift_card_prefix: string;
  invoice_prefix: string;
  delivery_note_prefix: string;
  legal_email: string | null;
  legal_mentions: string | null;
  payment_terms_days: number;
  late_payment_penalty_text: string | null;
  fixed_recovery_fee_cents: number;
  discount_reasons: string[];
}

export const DEFAULT_POS_PAYMENT_METHODS: PosPaymentMethodsConfig = {
  cash: true,
  card: true,
  transfer: false,
  gift_card: false,
  stripe: true,
};

export const DEFAULT_DISCOUNT_REASONS = [
  "Geste commercial",
  "Promotion",
  "Fidélité",
  "Erreur de prix",
  "Personnel",
] as const;

export const DEFAULT_POS_SETTINGS: Omit<PosSettings, "tenant_id"> = {
  country_code: "FR",
  currency: "eur",
  price_display: "ttc",
  default_vat_rate_bps: 2000,
  service_vat_rate_bps: 2000,
  product_vat_rate_bps: 2000,
  payment_methods: DEFAULT_POS_PAYMENT_METHODS,
  ticket_header: null,
  ticket_footer: null,
  legal_name: null,
  legal_address: null,
  vat_number: null,
  siret: null,
  ticket_prefix: "TK",
  fiscal_regime: "standard",
  require_open_session: false,
  default_opening_float_cents: 0,
  credit_note_prefix: "AV",
  gift_card_prefix: "GC",
  invoice_prefix: "FAC",
  delivery_note_prefix: "BLC",
  legal_email: null,
  legal_mentions: null,
  payment_terms_days: 0,
  late_payment_penalty_text: null,
  fixed_recovery_fee_cents: 4000,
  discount_reasons: [...DEFAULT_DISCOUNT_REASONS],
};

function parsePaymentMethods(raw: unknown): PosPaymentMethodsConfig {
  const base = { ...DEFAULT_POS_PAYMENT_METHODS };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as PosPaymentMethodKey[]) {
    if (typeof obj[key] === "boolean") {
      base[key] = obj[key];
    }
  }
  return base;
}

export function parseDiscountReasons(raw: unknown): string[] {
  const source = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split("\n")
      : DEFAULT_DISCOUNT_REASONS;
  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") continue;
    const value = item.trim().replace(/\s+/g, " ");
    if (!value || value.length > 80) continue;
    const key = value.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    reasons.push(value);
    if (reasons.length >= 24) break;
  }
  return reasons.length > 0 ? reasons : [...DEFAULT_DISCOUNT_REASONS];
}

export async function rememberDiscountReason(
  supabase: Db,
  tenantId: string,
  reason: string | null | undefined,
): Promise<void> {
  const value = reason?.trim().replace(/\s+/g, " ") ?? "";
  if (!value || value.length > 80) return;
  const settings = await getPosSettings(supabase, tenantId);
  const key = value.toLocaleLowerCase("fr");
  if (settings.discount_reasons.some((item) => item.toLocaleLowerCase("fr") === key)) {
    return;
  }
  const next = parseDiscountReasons([...settings.discount_reasons, value]);
  await supabase.from("inst_pos_settings").upsert(
    { tenant_id: tenantId, discount_reasons: next },
    { onConflict: "tenant_id" },
  );
}

export function rowToPosSettings(
  tenantId: string,
  row: Database["public"]["Tables"]["inst_pos_settings"]["Row"] | null,
): PosSettings {
  if (!row) {
    return { tenant_id: tenantId, ...DEFAULT_POS_SETTINGS };
  }
  return {
    tenant_id: row.tenant_id,
    country_code: getTaxCountry(row.country_code).code,
    currency: resolvePosCurrency(row.country_code, row.currency),
    price_display: row.price_display as PosPriceDisplay,
    default_vat_rate_bps: row.default_vat_rate_bps,
    service_vat_rate_bps: row.service_vat_rate_bps,
    product_vat_rate_bps: row.product_vat_rate_bps,
    payment_methods: parsePaymentMethods(row.payment_methods),
    ticket_header: row.ticket_header,
    ticket_footer: row.ticket_footer,
    legal_name: row.legal_name,
    legal_address: row.legal_address,
    vat_number: row.vat_number,
    siret: row.siret,
    ticket_prefix: row.ticket_prefix,
    fiscal_regime: (["standard", "nf525", "be_vat", "be_gks", "franchise"] as const).includes(
      row.fiscal_regime as PosFiscalRegime,
    )
      ? (row.fiscal_regime as PosFiscalRegime)
      : "standard",
    require_open_session: row.require_open_session ?? false,
    default_opening_float_cents: row.default_opening_float_cents ?? 0,
    credit_note_prefix: row.credit_note_prefix ?? "AV",
    gift_card_prefix: row.gift_card_prefix ?? "GC",
    invoice_prefix: row.invoice_prefix ?? "FAC",
    delivery_note_prefix: row.delivery_note_prefix ?? "BLC",
    legal_email: row.legal_email ?? null,
    legal_mentions: row.legal_mentions ?? null,
    payment_terms_days: row.payment_terms_days ?? 0,
    late_payment_penalty_text: row.late_payment_penalty_text ?? null,
    fixed_recovery_fee_cents: row.fixed_recovery_fee_cents ?? 4000,
    discount_reasons: parseDiscountReasons(row.discount_reasons),
  };
}

export async function getPosSettings(
  supabase: Db,
  tenantId: string,
): Promise<PosSettings> {
  const { data } = await supabase
    .from("inst_pos_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return rowToPosSettings(tenantId, data);
}

export function vatRateForLineType(
  settings: PosSettings,
  lineType: "service" | "product",
): number {
  if (isVatExemptRegime(settings.fiscal_regime)) return 0;
  return lineType === "service"
    ? settings.service_vat_rate_bps
    : settings.product_vat_rate_bps;
}

export function formatPosMoney(
  cents: number,
  settings: Pick<PosSettings, "currency">,
  locale = "fr",
): string {
  return formatPrice(cents, settings.currency, locale);
}

export function formatTicketNumber(
  prefix: string,
  seq: number,
  date = new Date(),
): string {
  const year = date.getFullYear();
  const num = String(seq).padStart(6, "0");
  return `${prefix}-${year}-${num}`;
}

export function formatDocumentNumber(prefix: string, seq: number): string {
  return `${prefix}-${seq}`;
}

export function vatRateLabel(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)} %`;
}
