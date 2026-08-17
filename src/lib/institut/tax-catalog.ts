export type PosFiscalRegime = "standard" | "nf525" | "be_vat" | "be_gks" | "franchise";

export type TaxRateBandId =
  | "standard"
  | "intermediate"
  | "reduced"
  | "super_reduced"
  | "parking"
  | "zero";

export type TaxRateBand = {
  id: TaxRateBandId;
  bps: number;
};

export type TaxCountryCode =
  | "FR"
  | "BE"
  | "LU"
  | "CH"
  | "NL"
  | "DE"
  | "ES"
  | "IT"
  | "PT"
  | "GB";

export type TaxCountryProfile = {
  code: TaxCountryCode;
  currency: string;
  currencies: readonly string[];
  vatName: string;
  companyIdLabel: string;
  vatNumberLabel: string;
  rates: readonly TaxRateBand[];
  suggestedServiceBand: TaxRateBandId;
  suggestedProductBand: TaxRateBandId;
  regimes: readonly PosFiscalRegime[];
  defaultRegime: PosFiscalRegime;
};

const EUR = ["eur"] as const;
const CHF = ["chf"] as const;
const GBP = ["gbp"] as const;

export const TAX_COUNTRY_CODES: readonly TaxCountryCode[] = [
  "FR",
  "BE",
  "LU",
  "CH",
  "NL",
  "DE",
  "ES",
  "IT",
  "PT",
  "GB",
];

export const POS_CURRENCIES = ["eur", "chf", "gbp", "usd"] as const;

export const TAX_COUNTRIES: Record<TaxCountryCode, TaxCountryProfile> = {
  FR: {
    code: "FR",
    currency: "eur",
    currencies: EUR,
    vatName: "TVA",
    companyIdLabel: "SIRET",
    vatNumberLabel: "N° TVA intracommunautaire",
    rates: [
      { id: "standard", bps: 2000 },
      { id: "intermediate", bps: 1000 },
      { id: "reduced", bps: 550 },
      { id: "super_reduced", bps: 210 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard", "nf525", "franchise"],
    defaultRegime: "standard",
  },
  BE: {
    code: "BE",
    currency: "eur",
    currencies: EUR,
    vatName: "TVA",
    companyIdLabel: "BCE / RPM",
    vatNumberLabel: "N° TVA (BE)",
    rates: [
      { id: "standard", bps: 2100 },
      { id: "intermediate", bps: 1200 },
      { id: "reduced", bps: 600 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard", "be_vat", "be_gks"],
    defaultRegime: "be_vat",
  },
  LU: {
    code: "LU",
    currency: "eur",
    currencies: EUR,
    vatName: "TVA",
    companyIdLabel: "N° RCS",
    vatNumberLabel: "N° TVA (LU)",
    rates: [
      { id: "standard", bps: 1700 },
      { id: "parking", bps: 1400 },
      { id: "intermediate", bps: 800 },
      { id: "super_reduced", bps: 300 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  CH: {
    code: "CH",
    currency: "chf",
    currencies: CHF,
    vatName: "TVA / MWST",
    companyIdLabel: "IDE / UID",
    vatNumberLabel: "N° TVA (CHE)",
    rates: [
      { id: "standard", bps: 810 },
      { id: "parking", bps: 380 },
      { id: "reduced", bps: 260 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  NL: {
    code: "NL",
    currency: "eur",
    currencies: EUR,
    vatName: "btw",
    companyIdLabel: "KvK",
    vatNumberLabel: "btw-nummer",
    rates: [
      { id: "standard", bps: 2100 },
      { id: "reduced", bps: 900 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  DE: {
    code: "DE",
    currency: "eur",
    currencies: EUR,
    vatName: "USt",
    companyIdLabel: "Handelsregisternummer",
    vatNumberLabel: "USt-IdNr.",
    rates: [
      { id: "standard", bps: 1900 },
      { id: "reduced", bps: 700 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  ES: {
    code: "ES",
    currency: "eur",
    currencies: EUR,
    vatName: "IVA",
    companyIdLabel: "NIF / CIF",
    vatNumberLabel: "NIF-IVA",
    rates: [
      { id: "standard", bps: 2100 },
      { id: "reduced", bps: 1000 },
      { id: "super_reduced", bps: 400 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  IT: {
    code: "IT",
    currency: "eur",
    currencies: EUR,
    vatName: "IVA",
    companyIdLabel: "P. IVA / CF",
    vatNumberLabel: "Partita IVA",
    rates: [
      { id: "standard", bps: 2200 },
      { id: "reduced", bps: 1000 },
      { id: "intermediate", bps: 500 },
      { id: "super_reduced", bps: 400 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  PT: {
    code: "PT",
    currency: "eur",
    currencies: EUR,
    vatName: "IVA",
    companyIdLabel: "NIPC",
    vatNumberLabel: "NIF",
    rates: [
      { id: "standard", bps: 2300 },
      { id: "intermediate", bps: 1300 },
      { id: "reduced", bps: 600 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
  GB: {
    code: "GB",
    currency: "gbp",
    currencies: GBP,
    vatName: "VAT",
    companyIdLabel: "Company number",
    vatNumberLabel: "VAT number",
    rates: [
      { id: "standard", bps: 2000 },
      { id: "reduced", bps: 500 },
      { id: "zero", bps: 0 },
    ],
    suggestedServiceBand: "standard",
    suggestedProductBand: "standard",
    regimes: ["standard"],
    defaultRegime: "standard",
  },
};

export function isTaxCountryCode(value: string): value is TaxCountryCode {
  return (TAX_COUNTRY_CODES as readonly string[]).includes(value);
}

export function getTaxCountry(code: string | null | undefined): TaxCountryProfile {
  const normalized = (code ?? "FR").trim().toUpperCase();
  if (isTaxCountryCode(normalized)) return TAX_COUNTRIES[normalized];
  return TAX_COUNTRIES.FR;
}

export function bandBps(profile: TaxCountryProfile, bandId: TaxRateBandId): number {
  return profile.rates.find((r) => r.id === bandId)?.bps ?? profile.rates[0]?.bps ?? 0;
}

export function suggestedVatRates(profile: TaxCountryProfile): {
  defaultBps: number;
  serviceBps: number;
  productBps: number;
} {
  const serviceBps = bandBps(profile, profile.suggestedServiceBand);
  const productBps = bandBps(profile, profile.suggestedProductBand);
  return {
    defaultBps: serviceBps,
    serviceBps,
    productBps,
  };
}

export function isVatExemptRegime(regime: string): boolean {
  return regime === "franchise";
}

export function resolvePosCurrency(
  countryCode: string,
  requested: string | null | undefined,
): string {
  const profile = getTaxCountry(countryCode);
  const currency = (requested ?? "").trim().toLowerCase();
  if ((POS_CURRENCIES as readonly string[]).includes(currency)) return currency;
  return profile.currency;
}

export function resolvePosRegime(
  countryCode: string,
  requested: string | null | undefined,
): PosFiscalRegime {
  const profile = getTaxCountry(countryCode);
  const regime = (requested ?? "").trim();
  if (profile.regimes.includes(regime as PosFiscalRegime)) {
    return regime as PosFiscalRegime;
  }
  return profile.defaultRegime;
}
