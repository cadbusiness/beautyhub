import type { MobileBranding } from "@/lib/mobile/types";

type BrandingSource = Record<string, unknown> | null | undefined;

function pickColor(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickUrl(...values: (string | null | undefined)[]): string | null | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v === null) return null;
  }
  return undefined;
}

function readBranding(source: BrandingSource): MobileBranding {
  if (!source) return {};
  const s = source as Record<string, unknown>;
  return {
    primaryColor: typeof s.primaryColor === "string" ? s.primaryColor : undefined,
    accentColor: typeof s.accentColor === "string" ? s.accentColor : undefined,
    backgroundColor: typeof s.backgroundColor === "string" ? s.backgroundColor : undefined,
    logoUrl: typeof s.logoUrl === "string" ? s.logoUrl : s.logoUrl === null ? null : undefined,
    iconUrl: typeof s.iconUrl === "string" ? s.iconUrl : s.iconUrl === null ? null : undefined,
    splashImageUrl:
      typeof s.splashImageUrl === "string"
        ? s.splashImageUrl
        : s.splashImageUrl === null
          ? null
          : undefined,
    fontFamily: typeof s.fontFamily === "string" ? s.fontFamily : undefined,
  };
}

/** Fusionne brand → tenant → app + couleurs site institut si disponibles. */
export function resolveMobileBranding(input: {
  brandBranding: BrandingSource;
  tenantBranding?: BrandingSource;
  appBranding: BrandingSource;
  sitePrimaryColor?: string | null;
  siteLogoUrl?: string | null;
}): MobileBranding {
  const brand = readBranding(input.brandBranding);
  const tenant = readBranding(input.tenantBranding);
  const app = readBranding(input.appBranding);

  return {
    primaryColor: pickColor(
      app.primaryColor,
      tenant.primaryColor,
      input.sitePrimaryColor,
      brand.primaryColor,
      "#0f172a",
    ),
    accentColor: pickColor(app.accentColor, tenant.accentColor, brand.accentColor, "#6366f1"),
    backgroundColor: pickColor(app.backgroundColor, tenant.backgroundColor, brand.backgroundColor),
    logoUrl: pickUrl(app.logoUrl, tenant.logoUrl, input.siteLogoUrl, brand.logoUrl) ?? null,
    iconUrl: pickUrl(app.iconUrl, tenant.iconUrl, brand.iconUrl) ?? null,
    splashImageUrl: pickUrl(app.splashImageUrl, tenant.splashImageUrl, brand.splashImageUrl) ?? null,
    fontFamily: app.fontFamily ?? tenant.fontFamily ?? brand.fontFamily,
  };
}
