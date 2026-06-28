import type { SiteBlock, SiteBlockType } from "@/lib/institut/site-pages";

function col(id: string, heading: string, body: string) {
  return { id, heading, body };
}

export function createSiteBlock(type: SiteBlockType): SiteBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "hero":
      return {
        id,
        type,
        headline: "Titre",
        subheadline: "Sous-titre",
        ctaLabel: "Réserver",
        ctaHref: "/reserver",
      };
    case "about":
      return { id, type, title: "À propos", body: "Texte de présentation…" };
    case "text":
      return { id, type, heading: "", body: "Votre texte ici…", align: "left" };
    case "image":
      return {
        id,
        type,
        imageUrl: "",
        caption: "",
        alt: "",
        linkHref: "",
        width: "full",
      };
    case "columns":
      return {
        id,
        type,
        title: "",
        columnCount: 2,
        columns: [
          col(crypto.randomUUID(), "Colonne 1", "Contenu…"),
          col(crypto.randomUUID(), "Colonne 2", "Contenu…"),
        ],
      };
    case "spacer":
      return { id, type, height: 32 };
    case "divider":
      return { id, type, style: "line" };
    case "services":
      return {
        id,
        type,
        title: "Prestations",
        showPrices: true,
        showImages: true,
        showSearch: false,
        limit: 6,
      };
    case "gallery":
      return { id, type, title: "Galerie", images: [], columns: 3 };
    case "contact":
      return {
        id,
        type,
        title: "Nous contacter",
        phone: "",
        email: "",
        address: "",
        note: "",
      };
    case "cta":
      return {
        id,
        type,
        title: "Appel à l'action",
        body: "Réservez votre créneau.",
        buttonLabel: "Réserver",
        buttonHref: "/reserver",
      };
    case "hours":
      return { id, type, title: "Horaires", note: "Sur rendez-vous.", useSchedule: false };
  }
}
