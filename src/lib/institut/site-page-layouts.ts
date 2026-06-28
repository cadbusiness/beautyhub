import type { SiteBlock, SitePageType, SiteTemplateId } from "./site-pages";
import { blockId } from "./site-pages-utils";

/** Identifiant d'un modèle de page (structure + style visuel). */
export type SitePageLayoutId = string;

export interface SitePageLayoutDef {
  id: SitePageLayoutId;
  pageType: SitePageType;
  labelKey: string;
  descriptionKey: string;
  style: SiteTemplateId;
  /** Blocs représentés dans la mini-vignette (ordre visuel). */
  thumbnailBlocks: Array<"hero" | "about" | "services" | "gallery" | "hours" | "contact" | "cta">;
  blocks: (instituteName: string) => SiteBlock[];
}

const LEGACY_LAYOUT_MAP: Record<string, SitePageLayoutId> = {
  elegant: "home-vitrine",
  modern: "home-impact",
};

export function normalizeLayoutId(
  pageType: SitePageType,
  raw: string | null | undefined,
): SitePageLayoutId {
  if (!raw) return defaultLayoutId(pageType);
  if (raw === "elegant" || raw === "modern") {
    if (pageType === "home") return LEGACY_LAYOUT_MAP[raw];
    return defaultLayoutId(pageType);
  }
  const layouts = layoutsForPageType(pageType);
  if (layouts.some((l) => l.id === raw)) return raw;
  return defaultLayoutId(pageType);
}

export function defaultLayoutId(pageType: SitePageType): SitePageLayoutId {
  return layoutsForPageType(pageType)[0]?.id ?? "home-vitrine";
}

export function layoutVisualStyle(layoutId: SitePageLayoutId): SiteTemplateId {
  for (const layouts of Object.values(PAGE_LAYOUTS)) {
    const found = layouts.find((l) => l.id === layoutId);
    if (found) return found.style;
  }
  return "elegant";
}

export function getLayoutDef(
  pageType: SitePageType,
  layoutId: SitePageLayoutId,
): SitePageLayoutDef | undefined {
  return layoutsForPageType(pageType).find((l) => l.id === layoutId);
}

export function layoutsForPageType(pageType: SitePageType): SitePageLayoutDef[] {
  return PAGE_LAYOUTS[pageType] ?? [];
}

export const PAGE_LAYOUTS: Record<SitePageType, SitePageLayoutDef[]> = {
  home: [
    {
      id: "home-vitrine",
      pageType: "home",
      labelKey: "homeVitrine",
      descriptionKey: "homeVitrineDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "about", "services", "cta"],
      blocks: (name) => [
        {
          id: blockId(),
          type: "hero",
          headline: name,
          subheadline: "Votre moment beauté, sur mesure.",
          ctaLabel: "Réserver en ligne",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "about",
          title: "Bienvenue",
          body: "Découvrez nos soins et notre équipe passionnée.",
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
      ],
    },
    {
      id: "home-impact",
      pageType: "home",
      labelKey: "homeImpact",
      descriptionKey: "homeImpactDesc",
      style: "modern",
      thumbnailBlocks: ["hero", "services", "cta"],
      blocks: (name) => [
        {
          id: blockId(),
          type: "hero",
          headline: name,
          subheadline: "L'excellence beauté, à portée de clic.",
          ctaLabel: "Réserver",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "services",
          title: "Nos soins",
          showPrices: true,
          showImages: true,
          showSearch: false,
          limit: 6,
        },
        {
          id: blockId(),
          type: "cta",
          title: "Réservez maintenant",
          body: "Créneaux disponibles en ligne.",
          buttonLabel: "Réserver",
          buttonHref: "/reserver",
        },
      ],
    },
    {
      id: "home-minimal",
      pageType: "home",
      labelKey: "homeMinimal",
      descriptionKey: "homeMinimalDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "cta"],
      blocks: (name) => [
        {
          id: blockId(),
          type: "hero",
          headline: name,
          subheadline: "Réservez votre soin en quelques clics.",
          ctaLabel: "Prendre rendez-vous",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "cta",
          title: "À bientôt",
          body: "Nous avons hâte de vous accueillir.",
          buttonLabel: "Réserver",
          buttonHref: "/reserver",
        },
      ],
    },
  ],
  catalog: [
    {
      id: "catalog-grille",
      pageType: "catalog",
      labelKey: "catalogGrille",
      descriptionKey: "catalogGrilleDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "services"],
      blocks: () => [
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
      ],
    },
    {
      id: "catalog-liste",
      pageType: "catalog",
      labelKey: "catalogListe",
      descriptionKey: "catalogListeDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "services"],
      blocks: () => [
        {
          id: blockId(),
          type: "hero",
          headline: "Tarifs & prestations",
          subheadline: "Tous nos soins",
          ctaLabel: "Réserver",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "services",
          title: "Liste des soins",
          showPrices: true,
          showImages: false,
          showSearch: true,
          limit: 24,
        },
      ],
    },
    {
      id: "catalog-vitrine",
      pageType: "catalog",
      labelKey: "catalogVitrine",
      descriptionKey: "catalogVitrineDesc",
      style: "modern",
      thumbnailBlocks: ["hero", "services", "cta"],
      blocks: () => [
        {
          id: blockId(),
          type: "hero",
          headline: "Catalogue beauté",
          subheadline: "Photos et descriptions",
          ctaLabel: "Réserver un soin",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "services",
          title: "Nos prestations",
          showPrices: true,
          showImages: true,
          showSearch: false,
          limit: 12,
        },
        {
          id: blockId(),
          type: "cta",
          title: "Une question ?",
          body: "Contactez-nous ou réservez directement.",
          buttonLabel: "Réserver",
          buttonHref: "/reserver",
        },
      ],
    },
  ],
  booking: [
    {
      id: "booking-guide",
      pageType: "booking",
      labelKey: "bookingGuide",
      descriptionKey: "bookingGuideDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "about"],
      blocks: () => [
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
      ],
    },
    {
      id: "booking-direct",
      pageType: "booking",
      labelKey: "bookingDirect",
      descriptionKey: "bookingDirectDesc",
      style: "modern",
      thumbnailBlocks: ["hero"],
      blocks: () => [
        {
          id: blockId(),
          type: "hero",
          headline: "Prendre rendez-vous",
          subheadline: "Simple, rapide, en ligne",
          ctaLabel: "Commencer",
          ctaHref: "#booking",
        },
      ],
    },
  ],
  contact: [
    {
      id: "contact-complet",
      pageType: "contact",
      labelKey: "contactComplet",
      descriptionKey: "contactCompletDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "hours", "contact"],
      blocks: () => [
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
      ],
    },
    {
      id: "contact-simple",
      pageType: "contact",
      labelKey: "contactSimple",
      descriptionKey: "contactSimpleDesc",
      style: "elegant",
      thumbnailBlocks: ["hero", "contact"],
      blocks: () => [
        {
          id: blockId(),
          type: "hero",
          headline: "Nous contacter",
          subheadline: "Une question ? Écrivez-nous.",
          ctaLabel: "Réserver",
          ctaHref: "/reserver",
        },
        {
          id: blockId(),
          type: "contact",
          title: "Coordonnées",
          phone: "",
          email: "",
          address: "",
          note: "",
        },
      ],
    },
  ],
};

export function defaultBlocksForLayout(
  pageType: SitePageType,
  layoutId: SitePageLayoutId,
  instituteName: string,
): SiteBlock[] {
  const def = getLayoutDef(pageType, layoutId);
  if (def) return def.blocks(instituteName);
  return PAGE_LAYOUTS[pageType][0].blocks(instituteName);
}
