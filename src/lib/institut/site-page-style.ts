import type { CSSProperties } from "react";

export type SitePageMaxWidth = "full" | "6xl" | "5xl" | "4xl";

export interface SitePageStyle {
  backgroundColor: string | null;
  marginX: number;
  paddingX: number;
  paddingY: number;
  maxWidth: SitePageMaxWidth;
  borderRadius: number;
}

export const DEFAULT_SITE_PAGE_STYLE: SitePageStyle = {
  backgroundColor: null,
  marginX: 0,
  paddingX: 0,
  paddingY: 0,
  maxWidth: "full",
  borderRadius: 0,
};

const MAX_WIDTHS = new Set<SitePageMaxWidth>(["full", "6xl", "5xl", "4xl"]);

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  return null;
}

export function normalizeSitePageStyle(raw: unknown): SitePageStyle {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SITE_PAGE_STYLE };
  const o = raw as Record<string, unknown>;
  const maxWidth =
    typeof o.maxWidth === "string" && MAX_WIDTHS.has(o.maxWidth as SitePageMaxWidth)
      ? (o.maxWidth as SitePageMaxWidth)
      : DEFAULT_SITE_PAGE_STYLE.maxWidth;

  return {
    backgroundColor: normalizeColor(o.backgroundColor),
    marginX: clamp(Number(o.marginX), 0, 120),
    paddingX: clamp(Number(o.paddingX), 0, 120),
    paddingY: clamp(Number(o.paddingY), 0, 120),
    maxWidth,
    borderRadius: clamp(Number(o.borderRadius), 0, 64),
  };
}

export function parseSitePageStyle(raw: unknown): SitePageStyle {
  return normalizeSitePageStyle(raw);
}

export const SITE_PAGE_MAX_WIDTH_CLASS: Record<SitePageMaxWidth, string> = {
  full: "max-w-none",
  "6xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  "4xl": "max-w-4xl",
};

export function sitePageMainStyle(style: SitePageStyle): CSSProperties {
  return style.backgroundColor ? { backgroundColor: style.backgroundColor } : {};
}

export function sitePageContentStyle(style: SitePageStyle): CSSProperties {
  const s: CSSProperties = {};
  if (style.marginX > 0) {
    s.marginLeft = style.marginX;
    s.marginRight = style.marginX;
  }
  if (style.paddingX > 0) {
    s.paddingLeft = style.paddingX;
    s.paddingRight = style.paddingX;
  }
  if (style.paddingY > 0) {
    s.paddingTop = style.paddingY;
    s.paddingBottom = style.paddingY;
  }
  if (style.borderRadius > 0) {
    s.borderRadius = style.borderRadius;
    s.overflow = "hidden";
  }
  return s;
}
