import { getTranslations } from "next-intl/server";

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  href: string;
  keywords: string[];
};

const ARTICLE_META = [
  {
    id: "add_service",
    href: "/institut/prestations",
    keywords: [
      "prestation",
      "service",
      "ajouter",
      "creer",
      "créer",
      "nouveau",
      "nouvelle",
      "tarif",
      "add",
      "create",
      "treatment",
    ],
  },
  {
    id: "add_client",
    href: "/institut/clients",
    keywords: [
      "client",
      "ajouter",
      "creer",
      "créer",
      "nouveau",
      "nouvelle",
      "fiche",
      "add",
      "create",
      "customer",
    ],
  },
  {
    id: "open_pos",
    href: "/institut/caisse/session",
    keywords: [
      "caisse",
      "ouvrir",
      "session",
      "fond",
      "demarrer",
      "démarrer",
      "encaisser",
      "pos",
      "register",
      "open",
      "checkout",
    ],
  },
  {
    id: "appointments",
    href: "/institut/rendez-vous",
    keywords: [
      "rdv",
      "rendez-vous",
      "rendez vous",
      "calendrier",
      "creneau",
      "créneau",
      "planning",
      "appointment",
      "calendar",
      "booking",
    ],
  },
  {
    id: "team_time_off",
    href: "/institut/equipe",
    keywords: [
      "absence",
      "conge",
      "congé",
      "vacance",
      "indisponible",
      "fermeture",
      "equipe",
      "équipe",
      "time off",
      "leave",
      "vacation",
    ],
  },
  {
    id: "courses",
    href: "/academie/formations",
    keywords: [
      "formation",
      "cours",
      "academie",
      "académie",
      "eleve",
      "élève",
      "cree",
      "créer",
      "course",
      "training",
    ],
  },
  {
    id: "pos_checkout",
    href: "/institut/caisse",
    keywords: [
      "vente",
      "encaisser",
      "checkout",
      "panier",
      "payer",
      "ticket",
      "sale",
      "pay",
      "cart",
    ],
  },
] as const;

type ArticleId = (typeof ARTICLE_META)[number]["id"];

export async function loadHelpArticles(): Promise<HelpArticle[]> {
  const t = await getTranslations("assistant.knowledge.articles");

  return ARTICLE_META.map((meta) => ({
    id: meta.id,
    href: meta.href,
    keywords: [...meta.keywords],
    title: t(`${meta.id}.title`),
    summary: t(`${meta.id}.summary`),
    steps: [t(`${meta.id}.step1`), t(`${meta.id}.step2`), t(`${meta.id}.step3`)],
  }));
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function findHelpArticle(message: string, articles: HelpArticle[]): HelpArticle | null {
  const norm = normalize(message);
  let best: HelpArticle | null = null;
  let bestScore = 0;

  for (const article of articles) {
    let score = 0;
    for (const kw of article.keywords) {
      if (norm.includes(normalize(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = article;
    }
  }

  return bestScore >= 2 ? best : null;
}

export function formatHelpArticle(article: HelpArticle): string {
  const steps = article.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${article.summary}\n\n${steps}`;
}

export function buildKnowledgeCatalog(articles: HelpArticle[]): string {
  return articles
    .map((a) => `- ${a.id}: ${a.title} — ${a.summary} (lien: ${a.href})`)
    .join("\n");
}

export function looksLikeHelpQuestion(message: string): boolean {
  const norm = normalize(message);
  return (
    /^(comment|ou |où |aide|help|je ne sais|je sais pas|explique|procedure|procédure|how|what)/.test(
      norm,
    ) ||
    norm.includes("comment faire") ||
    norm.includes("comment on") ||
    norm.includes("how do") ||
    norm.includes("how to")
  );
}

export function looksLikeSupportIssue(message: string): boolean {
  const norm = normalize(message);
  return (
    norm.includes("bug") ||
    norm.includes("erreur") ||
    norm.includes("error") ||
    norm.includes("marche pas") ||
    norm.includes("ne fonctionne") ||
    norm.includes("not working") ||
    norm.includes("probleme") ||
    norm.includes("problème") ||
    norm.includes("problem") ||
    norm.includes("bloque") ||
    norm.includes("bloqué") ||
    norm.includes("blocked") ||
    norm.includes("support") ||
    norm.includes("aide technique") ||
    norm.includes("technical help")
  );
}

export function getArticleById(articles: HelpArticle[], id: ArticleId): HelpArticle | undefined {
  return articles.find((a) => a.id === id);
}
