export type SitePageType = "home" | "booking" | "catalog" | "contact";
export type SiteTemplateId = "elegant" | "modern";

export type SiteBlockType =
  | "hero"
  | "about"
  | "text"
  | "services"
  | "cta"
  | "hours"
  | "gallery"
  | "contact"
  | "image"
  | "columns"
  | "spacer"
  | "divider";

export interface SiteGalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface SiteGalleryBlock extends SiteBlockBase {
  type: "gallery";
  title: string;
  images: SiteGalleryImage[];
  columns: 2 | 3 | 4;
}

export interface SiteContactBlock extends SiteBlockBase {
  type: "contact";
  title: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

export interface SiteBlockBase {
  id: string;
  type: SiteBlockType;
}

export interface SiteHeroBlock extends SiteBlockBase {
  type: "hero";
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
}

export interface SiteAboutBlock extends SiteBlockBase {
  type: "about";
  title: string;
  body: string;
}

export interface SiteTextBlock extends SiteBlockBase {
  type: "text";
  heading: string;
  body: string;
  align: "left" | "center";
}

export interface SiteImageBlock extends SiteBlockBase {
  type: "image";
  imageUrl: string;
  caption: string;
  alt: string;
  linkHref: string;
  width: "full" | "medium" | "small";
}

export interface SiteColumnItem {
  id: string;
  heading: string;
  body: string;
}

export interface SiteColumnsBlock extends SiteBlockBase {
  type: "columns";
  title: string;
  columnCount: 2 | 3;
  columns: SiteColumnItem[];
}

export interface SiteSpacerBlock extends SiteBlockBase {
  type: "spacer";
  height: number;
}

export interface SiteDividerBlock extends SiteBlockBase {
  type: "divider";
  style: "line" | "space";
}

export interface SiteServicesBlock extends SiteBlockBase {
  type: "services";
  title: string;
  showPrices: boolean;
  showImages: boolean;
  showSearch: boolean;
  limit: number;
}

export interface SiteHoursBlock extends SiteBlockBase {
  type: "hours";
  title: string;
  note: string;
  useSchedule: boolean;
}

export interface SiteCtaBlock extends SiteBlockBase {
  type: "cta";
  title: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
}

export type SiteBlock =
  | SiteHeroBlock
  | SiteAboutBlock
  | SiteTextBlock
  | SiteServicesBlock
  | SiteCtaBlock
  | SiteHoursBlock
  | SiteGalleryBlock
  | SiteContactBlock
  | SiteImageBlock
  | SiteColumnsBlock
  | SiteSpacerBlock
  | SiteDividerBlock;

export interface SitePageRow {
  id: string;
  tenant_id: string;
  page_type: SitePageType;
  slug: string;
  /** Modèle de page (ex. home-vitrine). Stocké en base dans `template_id`. */
  layout_id: string;
  title: string;
  is_published: boolean;
  is_home: boolean;
  show_in_nav: boolean;
  sort_order: number;
  content: SiteBlock[];
  seo_title: string | null;
  seo_description: string | null;
  page_style: import("./site-page-style").SitePageStyle;
  created_at: string;
  updated_at: string;
}

export interface PublicSitePage {
  id: string;
  page_type: SitePageType;
  slug: string;
  layout_id: string;
  title: string;
  content: SiteBlock[];
  seo_title: string | null;
  seo_description: string | null;
}

export const SITE_TEMPLATES: {
  id: SiteTemplateId;
  labelKey: string;
  descriptionKey: string;
}[] = [
  { id: "elegant", labelKey: "elegant", descriptionKey: "elegantDesc" },
  { id: "modern", labelKey: "modern", descriptionKey: "modernDesc" },
];

export const SITE_PAGE_TYPE_SORT: Record<SitePageType, { sort_order: number; show_in_nav: boolean }> = {
  home: { sort_order: 0, show_in_nav: true },
  catalog: { sort_order: 10, show_in_nav: true },
  booking: { sort_order: 20, show_in_nav: false },
  contact: { sort_order: 30, show_in_nav: true },
};

export const SITE_PAGE_TYPES: {
  type: SitePageType;
  labelKey: string;
  descriptionKey: string;
  defaultSlug: string;
  canBeHome: boolean;
}[] = [
  {
    type: "home",
    labelKey: "home",
    descriptionKey: "homeDesc",
    defaultSlug: "",
    canBeHome: true,
  },
  {
    type: "booking",
    labelKey: "booking",
    descriptionKey: "bookingDesc",
    defaultSlug: "reserver",
    canBeHome: false,
  },
  {
    type: "catalog",
    labelKey: "catalog",
    descriptionKey: "catalogDesc",
    defaultSlug: "prestations",
    canBeHome: false,
  },
  {
    type: "contact",
    labelKey: "contact",
    descriptionKey: "contactDesc",
    defaultSlug: "contact",
    canBeHome: false,
  },
];

export const SITE_BLOCK_TYPES: { type: SiteBlockType; labelKey: string }[] = [
  { type: "columns", labelKey: "columns" },
  { type: "spacer", labelKey: "spacer" },
  { type: "divider", labelKey: "divider" },
  { type: "text", labelKey: "text" },
  { type: "hero", labelKey: "hero" },
  { type: "about", labelKey: "about" },
  { type: "cta", labelKey: "cta" },
  { type: "image", labelKey: "image" },
  { type: "gallery", labelKey: "gallery" },
  { type: "services", labelKey: "services" },
  { type: "hours", labelKey: "hours" },
  { type: "contact", labelKey: "contact" },
];

export function normalizeServicesBlock(block: SiteServicesBlock): SiteServicesBlock {
  return {
    ...block,
    showImages: block.showImages ?? true,
    showSearch: block.showSearch ?? false,
  };
}

export function normalizeHoursBlock(block: SiteHoursBlock): SiteHoursBlock {
  return {
    ...block,
    useSchedule: block.useSchedule ?? false,
  };
}

export function normalizeSiteBlocks(blocks: SiteBlock[]): SiteBlock[] {
  return blocks.map((b) => {
    if (b.type === "services") return normalizeServicesBlock(b);
    if (b.type === "hours") return normalizeHoursBlock(b);
    return b;
  });
}

function blockId(): string {
  return crypto.randomUUID();
}

export function defaultBlocksForPageType(
  pageType: SitePageType,
  instituteName: string,
): SiteBlock[] {
  if (pageType === "home") {
    return [
      {
        id: blockId(),
        type: "hero",
        headline: instituteName,
        subheadline: "Votre moment beauté, sur mesure.",
        ctaLabel: "Réserver en ligne",
        ctaHref: "/reserver",
      },
      {
        id: blockId(),
        type: "about",
        title: "Bienvenue",
        body: "Découvrez nos soins et notre équipe passionnée. Réservez votre créneau en quelques clics.",
      },
      {
        id: blockId(),
        type: "services",
        title: "Nos prestations",
        showPrices: true,
        showImages: true,
        showSearch: false,
        limit: 6,
      },
      {
        id: blockId(),
        type: "cta",
        title: "Prête à vous faire chouchouter ?",
        body: "Choisissez votre prestation et votre créneau en ligne.",
        buttonLabel: "Prendre rendez-vous",
        buttonHref: "/reserver",
      },
    ];
  }

  if (pageType === "catalog") {
    return [
      {
        id: blockId(),
        type: "hero",
        headline: "Nos prestations",
        subheadline: "Soins et rituels beauté",
        ctaLabel: "Réserver",
        ctaHref: "/reserver",
      },
      {
        id: blockId(),
        type: "services",
        title: "Catalogue",
        showPrices: true,
        showImages: true,
        showSearch: true,
        limit: 24,
      },
    ];
  }

  if (pageType === "contact") {
    return [
      {
        id: blockId(),
        type: "hero",
        headline: "Contact",
        subheadline: "Nous sommes à votre écoute",
        ctaLabel: "Réserver",
        ctaHref: "/reserver",
      },
      {
        id: blockId(),
        type: "hours",
        title: "Horaires",
        note: "",
        useSchedule: true,
      },
      {
        id: blockId(),
        type: "contact",
        title: "Nous contacter",
        phone: "",
        email: "",
        address: "",
        note: "",
      },
    ];
  }

  return [
    {
      id: blockId(),
      type: "hero",
      headline: "Réserver en ligne",
      subheadline: "Choisissez votre prestation et votre créneau",
      ctaLabel: "Commencer",
      ctaHref: "#booking",
    },
    {
      id: blockId(),
      type: "about",
      title: "Comment ça marche ?",
      body: "1. Choisissez une prestation\n2. Sélectionnez votre praticien\n3. Réservez votre créneau",
    },
  ];
}

export function defaultTitleForPageType(pageType: SitePageType, instituteName: string): string {
  const map: Record<SitePageType, string> = {
    home: `Accueil — ${instituteName}`,
    booking: "Réservation",
    catalog: "Prestations",
    contact: "Contact",
  };
  return map[pageType];
}

export function parseSiteBlocks(raw: unknown): SiteBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is SiteBlock =>
      typeof b === "object" &&
      b !== null &&
      typeof (b as SiteBlock).id === "string" &&
      typeof (b as SiteBlock).type === "string",
  );
}

export function publicPagePath(page: Pick<SitePageRow, "slug" | "is_home" | "page_type">): string {
  if (page.is_home || page.page_type === "home") return "/";
  if (page.page_type === "booking") return "/reserver";
  if (!page.slug) return "/";
  return `/p/${page.slug}`;
}

export function pagePublicUrl(baseUrl: string, page: Pick<SitePageRow, "slug" | "is_home" | "page_type">): string {
  const path = publicPagePath(page);
  return `${baseUrl}${path === "/" ? "" : path}`;
}
