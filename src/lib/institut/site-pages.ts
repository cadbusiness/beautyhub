export type SitePageType = "home" | "booking" | "catalog" | "contact";
export type SiteTemplateId = "elegant" | "modern";

export type SiteBlockType = "hero" | "about" | "services" | "cta" | "hours";

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

export interface SiteServicesBlock extends SiteBlockBase {
  type: "services";
  title: string;
  showPrices: boolean;
  limit: number;
}

export interface SiteCtaBlock extends SiteBlockBase {
  type: "cta";
  title: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface SiteHoursBlock extends SiteBlockBase {
  type: "hours";
  title: string;
  note: string;
}

export type SiteBlock =
  | SiteHeroBlock
  | SiteAboutBlock
  | SiteServicesBlock
  | SiteCtaBlock
  | SiteHoursBlock;

export interface SitePageRow {
  id: string;
  tenant_id: string;
  page_type: SitePageType;
  slug: string;
  template_id: SiteTemplateId;
  title: string;
  is_published: boolean;
  is_home: boolean;
  content: SiteBlock[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicSitePage {
  id: string;
  page_type: SitePageType;
  slug: string;
  template_id: SiteTemplateId;
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
  { type: "hero", labelKey: "hero" },
  { type: "about", labelKey: "about" },
  { type: "services", labelKey: "services" },
  { type: "hours", labelKey: "hours" },
  { type: "cta", labelKey: "cta" },
];

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
        limit: 12,
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
        note: "Sur rendez-vous uniquement.",
      },
    ];
  }

  return [
    {
      id: blockId(),
      type: "hero",
      headline: "Réserver",
      subheadline: "Prenez rendez-vous en ligne",
      ctaLabel: "Commencer",
      ctaHref: "/reserver",
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
