export type SubprocessorPurposeKey = "database" | "hosting" | "payments" | "ai";
export type SubprocessorLocationKey = "euUs" | "global" | "us";
export type SubprocessorSafeguardsKey = "dpaScc" | "dpaOptIn";

export type Subprocessor = {
  name: string;
  purposeKey: SubprocessorPurposeKey;
  locationKey: SubprocessorLocationKey;
  safeguardsKey: SubprocessorSafeguardsKey;
};

/** Sous-traitants techniques de la plateforme BeautyHub (hébergement SaaS). */
export const PLATFORM_SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase Inc.",
    purposeKey: "database",
    locationKey: "euUs",
    safeguardsKey: "dpaScc",
  },
  {
    name: "Vercel Inc.",
    purposeKey: "hosting",
    locationKey: "global",
    safeguardsKey: "dpaScc",
  },
  {
    name: "Stripe Inc.",
    purposeKey: "payments",
    locationKey: "global",
    safeguardsKey: "dpaScc",
  },
  {
    name: "OpenAI LLC",
    purposeKey: "ai",
    locationKey: "us",
    safeguardsKey: "dpaOptIn",
  },
];

export const SECURITY_METRICS = {
  rlsEnabled: true,
  credentialsEncryption: "AES-256-GCM",
  tenantIsolation: true,
  authProvider: "Supabase Auth",
} as const;
