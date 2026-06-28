import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type PosPriceDisplay = "ttc" | "ht";
export type PosFiscalRegime = "standard" | "nf525" | "be_vat" | "be_gks";
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
}

export const DEFAULT_POS_PAYMENT_METHODS: PosPaymentMethodsConfig = {
  cash: true,
  card: true,
  transfer: false,
  gift_card: false,
  stripe: true,
};

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

export function rowToPosSettings(
  tenantId: string,
  row: Database["public"]["Tables"]["inst_pos_settings"]["Row"] | null,
): PosSettings {
  if (!row) {
    return { tenant_id: tenantId, ...DEFAULT_POS_SETTINGS };
  }
  return {
    tenant_id: row.tenant_id,
    country_code: row.country_code,
    currency: row.currency,
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
    fiscal_regime: row.fiscal_regime as PosFiscalRegime,
    require_open_session: row.require_open_session ?? false,
    default_opening_float_cents: row.default_opening_float_cents ?? 0,
    credit_note_prefix: row.credit_note_prefix ?? "AV",
    gift_card_prefix: row.gift_card_prefix ?? "GC",
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
  return lineType === "service"
    ? settings.service_vat_rate_bps
    : settings.product_vat_rate_bps;
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

export function vatRateLabel(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)} %`;
}
