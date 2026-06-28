export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  href: string;
  keywords: string[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "add_service",
    title: "Ajouter une prestation",
    summary: "Créez une prestation depuis le menu Prestations.",
    steps: [
      "Ouvrez Prestations dans le menu latéral.",
      "Cliquez sur « + Nouvelle prestation ».",
      "Renseignez le nom, la durée et le tarif, puis enregistrez.",
    ],
    href: "/institut/prestations",
    keywords: ["prestation", "service", "ajouter", "creer", "créer", "nouveau", "nouvelle", "tarif"],
  },
  {
    id: "add_client",
    title: "Ajouter un client",
    summary: "Enregistrez un client depuis la liste Clients.",
    steps: [
      "Ouvrez Clients dans le menu.",
      "Cliquez sur « + Nouveau client ».",
      "Renseignez nom, email et téléphone.",
    ],
    href: "/institut/clients",
    keywords: ["client", "ajouter", "creer", "créer", "nouveau", "nouvelle", "fiche"],
  },
  {
    id: "open_pos",
    title: "Ouvrir la caisse",
    summary: "Une session caisse doit être ouverte avant d'encaisser.",
    steps: [
      "Allez dans Caisse → Session.",
      "Cliquez sur « Ouvrir la session ».",
      "Indiquez le fond de caisse initial si besoin.",
    ],
    href: "/institut/caisse/session",
    keywords: ["caisse", "ouvrir", "session", "fond", "demarrer", "démarrer", "encaisser"],
  },
  {
    id: "appointments",
    title: "Gérer les rendez-vous",
    summary: "Consultez le calendrier et créez des RDV.",
    steps: [
      "Ouvrez Rendez-vous dans le menu.",
      "Utilisez le calendrier pour voir les créneaux.",
      "Cliquez sur un créneau libre pour créer un RDV.",
    ],
    href: "/institut/rendez-vous",
    keywords: ["rdv", "rendez-vous", "rendez vous", "calendrier", "creneau", "créneau", "planning"],
  },
  {
    id: "team_time_off",
    title: "Planifier une absence",
    summary: "Déclarez congés ou indisponibilités depuis Équipe.",
    steps: [
      "Ouvrez Équipe dans le menu.",
      "Section absences : ajoutez une période pour un praticien ou l'institut.",
      "Vous pouvez aussi me demander en langage naturel (ex. « Léa en congé 5 jours »).",
    ],
    href: "/institut/equipe",
    keywords: ["absence", "conge", "congé", "vacance", "indisponible", "fermeture", "equipe", "équipe"],
  },
  {
    id: "courses",
    title: "Créer une formation",
    summary: "Publiez une formation depuis le module Académie.",
    steps: [
      "Ouvrez Académie → Formations.",
      "Cliquez sur « + Nouvelle formation ».",
      "Renseignez titre, description et tarif.",
    ],
    href: "/academie/formations",
    keywords: ["formation", "cours", "academie", "académie", "eleve", "élève", "cree", "créer"],
  },
  {
    id: "pos_checkout",
    title: "Enregistrer une vente",
    summary: "Encaissez depuis le terminal caisse.",
    steps: [
      "Vérifiez qu'une session caisse est ouverte.",
      "Allez dans Caisse (terminal).",
      "Ajoutez prestations/produits au panier et validez le paiement.",
    ],
    href: "/institut/caisse",
    keywords: ["vente", "encaisser", "checkout", "panier", "payer", "ticket"],
  },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function findHelpArticle(message: string): HelpArticle | null {
  const norm = normalize(message);
  let best: HelpArticle | null = null;
  let bestScore = 0;

  for (const article of HELP_ARTICLES) {
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

export function buildKnowledgeCatalog(): string {
  return HELP_ARTICLES.map(
    (a) => `- ${a.id}: ${a.title} — ${a.summary} (lien: ${a.href})`,
  ).join("\n");
}

export function looksLikeHelpQuestion(message: string): boolean {
  const norm = normalize(message);
  return (
    /^(comment|ou |où |aide|help|je ne sais|je sais pas|explique|procedure|procédure)/.test(
      norm,
    ) || norm.includes("comment faire") || norm.includes("comment on")
  );
}

export function looksLikeSupportIssue(message: string): boolean {
  const norm = normalize(message);
  return (
    norm.includes("bug") ||
    norm.includes("erreur") ||
    norm.includes("marche pas") ||
    norm.includes("ne fonctionne") ||
    norm.includes("probleme") ||
    norm.includes("problème") ||
    norm.includes("bloque") ||
    norm.includes("bloqué") ||
    norm.includes("support") ||
    norm.includes("aide technique")
  );
}
