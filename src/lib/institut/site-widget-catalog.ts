import type { SiteBlockType } from "@/lib/institut/site-pages";

export type SiteWidgetCategoryId = "layout" | "content" | "media" | "institut";

export interface SiteWidgetCategory {
  id: SiteWidgetCategoryId;
  labelKey: string;
  types: SiteBlockType[];
}

/** Catalogue widgets builder — ordre et regroupement type Elementor. */
export const SITE_WIDGET_CATEGORIES: SiteWidgetCategory[] = [
  {
    id: "layout",
    labelKey: "widgetCatLayout",
    types: ["columns", "spacer", "divider"],
  },
  {
    id: "content",
    labelKey: "widgetCatContent",
    types: ["text", "hero", "about", "cta"],
  },
  {
    id: "media",
    labelKey: "widgetCatMedia",
    types: ["image", "gallery"],
  },
  {
    id: "institut",
    labelKey: "widgetCatInstitut",
    types: ["services", "hours", "contact"],
  },
];

export const BLOCK_WIDGET_ICONS: Record<SiteBlockType, string> = {
  hero: "◆",
  about: "¶",
  text: "T",
  services: "☰",
  gallery: "▦",
  image: "⌾",
  columns: "▥",
  spacer: "↕",
  divider: "—",
  hours: "◷",
  contact: "✉",
  cta: "→",
};

export const BLOCK_WIDGET_HINTS: Partial<Record<SiteBlockType, string>> = {
  columns: "widgetHintColumns",
  text: "widgetHintText",
  image: "widgetHintImage",
  spacer: "widgetHintSpacer",
  divider: "widgetHintDivider",
};
