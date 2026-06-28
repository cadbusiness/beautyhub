import type { AIAction } from "@/modules/types";
import type { SupportCategory } from "@/lib/platform/support";
import type { ExecuteActionContext } from "./types";
import { getAiActionsFor } from "@/modules";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantContext } from "@/modules/institut/ai-helpers";
import { fetchPosContext } from "@/modules/institut/ai-pos-helpers";
import { fetchPlatformAiConfig } from "@/lib/platform/settings";
import { getLocale, getTranslations } from "next-intl/server";
import {
  buildKnowledgeCatalog,
  findHelpArticle,
  formatHelpArticle,
  getArticleById,
  loadHelpArticles,
  looksLikeHelpQuestion,
  looksLikeSupportIssue,
  type HelpArticle,
} from "./knowledge";

export type InterpretResult =
  | {
      type: "action";
      actionName: string;
      params: Record<string, unknown>;
      summary: string;
      needsConfirm: boolean;
    }
  | { type: "help"; message: string; links: { label: string; href: string }[] }
  | {
      type: "support_offer";
      summary: string;
      category: SupportCategory;
      subject: string;
      body: string;
    }
  | { type: "clarify"; message: string }
  | { type: "unknown"; message: string };

interface ActionCatalogEntry {
  name: string;
  description: string;
  parametersHint: string;
  needsConfirm: boolean;
}

type RouterT = Awaited<ReturnType<typeof getTranslations<"assistant.router">>>;

function zodFieldHints(schema: AIAction["parameters"]): string {
  const shape = (schema as { shape?: Record<string, { description?: string; _def?: { typeName?: string } }> })
    .shape;
  if (!shape) return "{}";
  return Object.entries(shape)
    .map(([key, field]) => {
      const desc = field.description ?? field._def?.typeName ?? "any";
      return `${key}: ${desc}`;
    })
    .join("; ");
}

function buildCatalog(actions: AIAction[]): ActionCatalogEntry[] {
  return actions.map((a) => ({
    name: a.name,
    description: a.description,
    parametersHint: zodFieldHints(a.parameters),
    needsConfirm: Boolean(a.confirm),
  }));
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function findStaffInMessage(message: string, staffNames: string[]): string | null {
  const norm = normalizeText(message);
  let best: string | null = null;
  for (const name of staffNames) {
    const parts = normalizeText(name).split(/\s+/);
    const first = parts[0];
    const full = normalizeText(name);
    if (norm.includes(full) || (first && first.length > 2 && norm.includes(first))) {
      if (!best || name.length > best.length) best = name;
    }
  }
  return best;
}

function parseFrenchDate(token: string, refYear = new Date().getFullYear()): Date | null {
  const months: Record<string, number> = {
    janvier: 0,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    decembre: 11,
  };

  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T09:00:00`);

  const dmy = token.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = dmy[3] ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : refYear;
    return new Date(year, month, day, 9, 0, 0);
  }

  const dm = token.match(/(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/i);
  if (dm) {
    const day = Number(dm[1]);
    const month = months[normalizeText(dm[2])];
    const year = dm[3] ? Number(dm[3]) : refYear;
    if (month !== undefined) return new Date(year, month, day, 9, 0, 0);
  }

  return null;
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale);
}

function helpFromArticle(article: HelpArticle): InterpretResult {
  return {
    type: "help",
    message: formatHelpArticle(article),
    links: [{ label: article.title, href: article.href }],
  };
}

function heuristicHelpOrSupport(
  message: string,
  pos: Awaited<ReturnType<typeof fetchPosContext>>,
  articles: HelpArticle[],
  t: RouterT,
): InterpretResult | null {
  if (looksLikeSupportIssue(message)) {
    const norm = normalizeText(message);
    const category: SupportCategory =
      norm.includes("bug") || norm.includes("erreur") || norm.includes("error") ? "bug" : "config";

    if (norm.includes("caisse") && !pos.openSession && (norm.includes("ouvr") || norm.includes("encaiss"))) {
      return {
        type: "help",
        message: t("posClosedHelp"),
        links: [{ label: t("openPosSessionLink"), href: "/institut/caisse/session" }],
      };
    }

    return {
      type: "support_offer",
      summary: category === "bug" ? t("supportBugSummary") : t("supportConfigSummary"),
      category,
      subject: message.slice(0, 120),
      body: message,
    };
  }

  if (looksLikeHelpQuestion(message)) {
    const article = findHelpArticle(message, articles);
    if (article) return helpFromArticle(article);
  }

  return null;
}

function heuristicRoute(
  message: string,
  catalog: ActionCatalogEntry[],
  context: Awaited<ReturnType<typeof fetchTenantContext>>,
  pos: Awaited<ReturnType<typeof fetchPosContext>>,
  articles: HelpArticle[],
  t: RouterT,
  locale: string,
): InterpretResult | null {
  const norm = normalizeText(message);
  const staffNames = context.staff.map((s) => s.full_name);

  const has = (...words: string[]) => words.some((w) => norm.includes(normalizeText(w)));

  const helpOrSupport = heuristicHelpOrSupport(message, pos, articles, t);
  if (helpOrSupport) return helpOrSupport;

  if (has("conge", "vacance", "absence", "fermeture", "indisponible", "leave", "vacation", "time off")) {
    const staffName = findStaffInMessage(message, staffNames);
    const daysMatch = message.match(/(\d+)\s+jours?/i) ?? message.match(/(\d+)\s+days?/i);
    const days = daysMatch ? Number(daysMatch[1]) : null;

    let start: Date | null = null;
    const datePatterns = [
      ...message.matchAll(/(\d{4}-\d{2}-\d{2})/g),
      ...message.matchAll(/(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)/g),
      ...message.matchAll(/(\d{1,2}\s+\w+(?:\s+\d{4})?)/gi),
    ];
    for (const m of datePatterns) {
      const parsed = parseFrenchDate(m[1]);
      if (parsed) {
        start = parsed;
        break;
      }
    }

    if (!start && days) {
      start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
    }

    if (start) {
      const end = new Date(start);
      if (days) end.setDate(end.getDate() + days);
      else end.setHours(18, 0, 0, 0);

      const scope = staffName
        ? "staff"
        : has("cabine", "ressource", "room")
          ? "resource"
          : "tenant";

      const startLabel = formatDate(start, locale);
      const endLabel = formatDate(end, locale);

      return {
        type: "action",
        actionName: "institut.create_time_off",
        params: {
          scope,
          staff_name: staffName ?? undefined,
          resource_name:
            scope === "resource"
              ? context.resources.find((r) => norm.includes(normalizeText(r.name)))?.name
              : undefined,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          reason: has("vacance", "conge", "vacation", "leave") ? t("vacationReason") : undefined,
        },
        summary: staffName
          ? t("timeOffStaffSummary", { name: staffName, start: startLabel, end: endLabel })
          : t("timeOffTenantSummary", { start: startLabel, end: endLabel }),
        needsConfirm: true,
      };
    }
  }

  if (has("liste", "lister", "montre", "affiche", "voir", "historique", "list", "show")) {
    if (has("vente", "ticket", "caisse", "sale") && !has("produit", "product")) {
      return matchList(catalog, "institut.pos_list_sales", { limit: 20 }, t("listSales"));
    }
    if (has("bon cadeau", "bon-cadeau", "bon cadeaux", "gift card")) {
      return matchList(catalog, "institut.pos_list_gift_cards", { limit: 20 }, t("listGiftCards"));
    }
    if (has("avoir", "avoirs", "credit note")) {
      return matchList(catalog, "institut.pos_list_credit_notes", { limit: 20 }, t("listCreditNotes"));
    }
    if (has("produit", "product") && has("caisse", "interne", "pos")) {
      return matchList(catalog, "institut.pos_list_products", { limit: 50 }, t("listProducts"));
    }
    if (has("client", "customer")) {
      return matchList(catalog, "institut.list_clients", { limit: 20 }, t("listClients"));
    }
    if (has("rdv", "rendez-vous", "rendez vous", "appointment")) {
      return matchList(catalog, "institut.list_appointments", { limit: 20 }, t("listAppointments"));
    }
    if (has("personnel", "praticien", "equipe", "staff", "team")) {
      return matchList(catalog, "institut.list_staff", {}, t("listStaff"));
    }
    if (has("cabine", "room", "resource")) {
      return matchList(catalog, "institut.list_resources", {}, t("listResources"));
    }
    if (has("prestation", "service", "treatment")) {
      return matchList(catalog, "institut.list_services", { limit: 50 }, t("listServices"));
    }
    if (has("horaire", "grille", "planning", "schedule")) {
      return matchList(catalog, "institut.list_schedules", {}, t("listSchedules"));
    }
    if (has("absence", "conge", "vacance", "fermeture", "leave")) {
      return matchList(catalog, "institut.list_time_off", { upcoming_only: true }, t("listTimeOff"));
    }
  }

  if (has("caisse", "session", "pos") && has("ouvr", "demarr", "start", "open")) {
    const floatMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    const opening = floatMatch ? Number.parseFloat(floatMatch[1].replace(",", ".")) : 0;
    return {
      type: "action",
      actionName: "institut.pos_open_session",
      params: { opening_float_euros: opening },
      summary: opening
        ? t("openSessionWithFloat", { amount: opening })
        : t("openSessionSummary"),
      needsConfirm: true,
    };
  }

  if (has("rapport x", "ticket x", "x report") || (has("rapport", "report") && has("intermediaire", "intermediate"))) {
    return matchList(catalog, "institut.pos_generate_x_report", {}, t("generateXReport"));
  }

  if (has("clotur", "ferme", "close") && has("caisse", "session", "rapport z", "z", "pos")) {
    const cashMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (cashMatch) {
      return {
        type: "action",
        actionName: "institut.pos_close_session",
        params: { counted_cash_euros: Number.parseFloat(cashMatch[1].replace(",", ".")) },
        summary: t("closeSessionSummary", { amount: cashMatch[1] }),
        needsConfirm: true,
      };
    }
    return {
      type: "clarify",
      message: t("closeSessionClarify"),
    };
  }

  if (
    has("bon cadeau", "bon-cadeau", "gift card") &&
    (has("creer", "créer", "emettre", "émettre", "faire", "ajoute", "create", "issue"))
  ) {
    const amountMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (amountMatch) {
      return {
        type: "action",
        actionName: "institut.pos_issue_gift_card",
        params: { amount_euros: Number.parseFloat(amountMatch[1].replace(",", ".")) },
        summary: t("giftCardSummary", { amount: amountMatch[1] }),
        needsConfirm: true,
      };
    }
    return { type: "clarify", message: t("giftCardClarify") };
  }

  if (has("caisse", "session", "pos") && (has("etat", "état", "status", "ouverte", "resume", "résumé", "open"))) {
    return matchList(
      catalog,
      "institut.pos_session_status",
      {},
      pos.openSession ? t("posSessionOpenSummary") : t("posSessionStatusSummary"),
    );
  }

  if (has("cree", "creer", "ajoute", "ajouter", "nouveau", "nouvelle", "create", "add", "new")) {
    if (has("client", "customer")) {
      const article = getArticleById(articles, "add_client");
      if (article) {
        return {
          type: "help",
          message: formatHelpArticle(article),
          links: [{ label: article.title, href: article.href }],
        };
      }
    }
    if (has("prestation", "service", "treatment")) {
      const article = findHelpArticle("ajouter prestation", articles) ?? getArticleById(articles, "add_service");
      if (article) return helpFromArticle(article);
    }
  }

  const direct = catalog.find(
    (a) =>
      normalizeText(a.description).includes(norm.slice(0, 24)) ||
      norm.includes(normalizeText(a.name.split(".").pop() ?? "")),
  );
  if (direct) {
    return {
      type: "action",
      actionName: direct.name,
      params: {},
      summary: direct.description,
      needsConfirm: direct.needsConfirm,
    };
  }

  return null;
}

function matchList(
  catalog: ActionCatalogEntry[],
  name: string,
  params: Record<string, unknown>,
  summary: string,
): InterpretResult | null {
  const entry = catalog.find((a) => a.name === name);
  if (!entry) return null;
  return {
    type: "action",
    actionName: name,
    params,
    summary,
    needsConfirm: entry.needsConfirm,
  };
}

function parseLlmResult(
  content: string,
  catalog: ActionCatalogEntry[],
  t: RouterT,
): InterpretResult | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (typeof parsed.help === "string") {
      const links = Array.isArray(parsed.links)
        ? (parsed.links as { label?: string; href?: string }[])
            .filter((l) => l.label && l.href)
            .map((l) => ({ label: String(l.label), href: String(l.href) }))
        : [];
      return { type: "help", message: parsed.help, links };
    }

    if (typeof parsed.support === "string") {
      const category = String(parsed.category ?? "config") as SupportCategory;
      const safeCategory: SupportCategory = ["help", "bug", "config", "feature_request"].includes(
        category,
      )
        ? category
        : "config";
      return {
        type: "support_offer",
        summary: String(parsed.support),
        category: safeCategory,
        subject: String(parsed.subject ?? parsed.support).slice(0, 120),
        body: String(parsed.body ?? parsed.support),
      };
    }

    if (typeof parsed.clarify === "string") {
      return { type: "clarify", message: parsed.clarify };
    }
    if (typeof parsed.unknown === "string") {
      return { type: "unknown", message: parsed.unknown };
    }
    if (typeof parsed.action === "string") {
      const entry = catalog.find((a) => a.name === parsed.action);
      if (!entry) return { type: "unknown", message: t("actionNotAllowed") };
      return {
        type: "action",
        actionName: parsed.action,
        params: (parsed.params as Record<string, unknown>) ?? {},
        summary: String(parsed.summary ?? entry.description),
        needsConfirm: entry.needsConfirm,
      };
    }
  } catch {
    return null;
  }

  return null;
}

const LOCALE_LABELS: Record<string, string> = {
  fr: "français",
  en: "English",
  es: "español",
  nl: "Nederlands",
};

async function openAiRoute(
  message: string,
  catalog: ActionCatalogEntry[],
  context: Awaited<ReturnType<typeof fetchTenantContext>>,
  pos: Awaited<ReturnType<typeof fetchPosContext>>,
  articles: HelpArticle[],
  t: RouterT,
  locale: string,
): Promise<InterpretResult | null> {
  const aiConfig = await fetchPlatformAiConfig();
  if (!aiConfig.enabled || !aiConfig.apiKey) return null;

  const responseLanguage = LOCALE_LABELS[locale] ?? locale;

  const system = `Tu es l'assistant IA de BeautyHub, un SaaS pour instituts de beauté.
Tu aides les utilisateurs à:
1) COMPRENDRE comment utiliser le logiciel (mode guide)
2) EXÉCUTER des actions métier (mode action)
3) DIAGNOSTIQUER un problème: erreur de configuration vs bug potentiel (mode support)

Réponds UNIQUEMENT en JSON valide. Tous les textes visibles par l'utilisateur doivent être en ${responseLanguage}.
Formats:
{"help":"explication pas-à-pas","links":[{"label":"...","href":"/chemin"}]}
{"support":"résumé pour l'utilisateur","category":"bug|config|feature_request|help","subject":"...","body":"..."}
{"action":"nom.action","params":{...},"summary":"phrase courte"}
{"clarify":"question si info manquante"}
{"unknown":"message si impossible"}

Règles support:
- Si c'est probablement une mauvaise manip (ex. caisse fermée, module non activé), réponds en {"help":...} avec les étapes.
- Si ça ressemble à un bug ou tu n'es pas sûr, propose {"support":...} avec category appropriée.
- Ne crée jamais un ticket automatiquement: propose seulement l'escalade.

Guides disponibles:
${buildKnowledgeCatalog(articles)}

Contexte tenant:
- Personnel: ${context.staff.map((s) => s.full_name).join(", ") || "aucun"}
- Cabines: ${context.resources.map((r) => r.name).join(", ") || "aucune"}
- Grilles horaires: ${context.schedules.map((s) => s.name).join(", ") || "aucune"}
- Prestations: ${context.services.map((s) => s.name).join(", ") || "aucune"}

Caisse:
- Session: ${pos.openSession ? `ouverte depuis ${pos.openSession.opened_at}` : "fermée"}
- Dernières ventes: ${pos.recentSales.map((s) => s.ticket_number ?? s.id.slice(0, 8)).join(", ") || "aucune"}

Date du jour: ${new Date().toISOString().slice(0, 10)}

Actions disponibles:
${catalog.map((a) => `- ${a.name}: ${a.description}. Paramètres: ${a.parametersHint}${a.needsConfirm ? " [confirmation requise]" : ""}`).join("\n")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;

  return parseLlmResult(content, catalog, t);
}

export async function interpretUserMessage(
  message: string,
  ctx: ExecuteActionContext,
): Promise<InterpretResult> {
  const t = await getTranslations("assistant.router");
  const locale = await getLocale();
  const articles = await loadHelpArticles();

  const trimmed = message.trim();
  if (!trimmed) {
    return { type: "clarify", message: t("emptyMessage") };
  }

  const actions = getAiActionsFor(ctx.enabledModuleIds, ctx.role);
  const catalog = buildCatalog(actions);
  const supabase = await createClient();
  const tenantContext = await fetchTenantContext(supabase, ctx.tenantId);
  const posContext = await fetchPosContext(supabase, ctx.tenantId);

  const llm = await openAiRoute(trimmed, catalog, tenantContext, posContext, articles, t, locale);
  if (llm) return llm;

  const heuristic = heuristicRoute(trimmed, catalog, tenantContext, posContext, articles, t, locale);
  if (heuristic) return heuristic;

  const aiConfig = await fetchPlatformAiConfig();
  return {
    type: "unknown",
    message: aiConfig.apiKey ? t("unknownWithKey") : t("unknownNoKey"),
  };
}

export function getActionMeta(actionName: string, ctx: ExecuteActionContext) {
  const actions = getAiActionsFor(ctx.enabledModuleIds, ctx.role);
  return actions.find((a) => a.name === actionName);
}
