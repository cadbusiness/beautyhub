import type { AIAction } from "@/modules/types";
import type { ExecuteActionContext } from "./types";
import { getAiActionsFor } from "@/modules";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantContext } from "@/modules/institut/ai-helpers";
import { fetchPosContext } from "@/modules/institut/ai-pos-helpers";

export type InterpretResult =
  | {
      type: "action";
      actionName: string;
      params: Record<string, unknown>;
      summary: string;
      needsConfirm: boolean;
    }
  | { type: "clarify"; message: string }
  | { type: "unknown"; message: string };

interface ActionCatalogEntry {
  name: string;
  description: string;
  parametersHint: string;
  needsConfirm: boolean;
}

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

function heuristicRoute(
  message: string,
  catalog: ActionCatalogEntry[],
  context: Awaited<ReturnType<typeof fetchTenantContext>>,
  pos: Awaited<ReturnType<typeof fetchPosContext>>,
): InterpretResult | null {
  const norm = normalizeText(message);
  const staffNames = context.staff.map((s) => s.full_name);

  const has = (...words: string[]) => words.some((w) => norm.includes(normalizeText(w)));

  if (has("conge", "vacance", "absence", "fermeture", "indisponible")) {
    const staffName = findStaffInMessage(message, staffNames);
    const daysMatch = message.match(/(\d+)\s+jours?/i);
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
        : has("cabine", "ressource")
          ? "resource"
          : "tenant";

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
          reason: has("vacance", "conge") ? "Vacances" : undefined,
        },
        summary: staffName
          ? `Congés pour ${staffName} du ${start.toLocaleDateString("fr")} au ${end.toLocaleDateString("fr")}`
          : `Absence institut du ${start.toLocaleDateString("fr")} au ${end.toLocaleDateString("fr")}`,
        needsConfirm: true,
      };
    }
  }

  if (has("liste", "lister", "montre", "affiche", "voir", "historique")) {
    if (has("vente", "ticket", "caisse") && !has("produit")) {
      return matchList(catalog, "institut.pos_list_sales", { limit: 20 }, "Lister les ventes caisse");
    }
    if (has("bon cadeau", "bon-cadeau", "bon cadeaux")) {
      return matchList(catalog, "institut.pos_list_gift_cards", { limit: 20 }, "Lister les bons cadeaux");
    }
    if (has("avoir", "avoirs")) {
      return matchList(catalog, "institut.pos_list_credit_notes", { limit: 20 }, "Lister les avoirs");
    }
    if (has("produit") && has("caisse", "interne")) {
      return matchList(catalog, "institut.pos_list_products", { limit: 50 }, "Lister les produits caisse");
    }
    if (has("client")) {
      return matchList(catalog, "institut.list_clients", { limit: 20 }, "Lister les clients");
    }
    if (has("rdv", "rendez-vous", "rendez vous")) {
      return matchList(catalog, "institut.list_appointments", { limit: 20 }, "Lister les rendez-vous");
    }
    if (has("personnel", "praticien", "equipe")) {
      return matchList(catalog, "institut.list_staff", {}, "Lister le personnel");
    }
    if (has("cabine")) {
      return matchList(catalog, "institut.list_resources", {}, "Lister les cabines");
    }
    if (has("prestation", "service")) {
      return matchList(catalog, "institut.list_services", { limit: 50 }, "Lister les prestations");
    }
    if (has("horaire", "grille", "planning")) {
      return matchList(catalog, "institut.list_schedules", {}, "Lister les grilles horaires");
    }
    if (has("absence", "conge", "vacance", "fermeture")) {
      return matchList(catalog, "institut.list_time_off", { upcoming_only: true }, "Lister les absences");
    }
  }

  if (has("caisse", "session") && has("ouvr", "demarr", "start")) {
    const floatMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    const opening = floatMatch ? Number.parseFloat(floatMatch[1].replace(",", ".")) : 0;
    return {
      type: "action",
      actionName: "institut.pos_open_session",
      params: { opening_float_euros: opening },
      summary: `Ouvrir la session caisse${opening ? ` avec ${opening} € de fond` : ""}`,
      needsConfirm: true,
    };
  }

  if (has("rapport x", "ticket x") || (has("rapport") && has("intermediaire"))) {
    return matchList(
      catalog,
      "institut.pos_generate_x_report",
      {},
      "Générer un rapport X",
    );
  }

  if (
    has("clotur", "ferme") &&
    has("caisse", "session", "rapport z", "z")
  ) {
    const cashMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (cashMatch) {
      return {
        type: "action",
        actionName: "institut.pos_close_session",
        params: { counted_cash_euros: Number.parseFloat(cashMatch[1].replace(",", ".")) },
        summary: `Clôturer la session caisse (${cashMatch[1]} € comptés)`,
        needsConfirm: true,
      };
    }
    return {
      type: "clarify",
      message: "Indiquez le montant espèces compté en caisse pour la clôture (ex. « clôture caisse avec 250 € »).",
    };
  }

  if (
    has("bon cadeau", "bon-cadeau") &&
    (has("creer", "créer", "emettre", "émettre", "faire", "ajoute"))
  ) {
    const amountMatch = message.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (amountMatch) {
      return {
        type: "action",
        actionName: "institut.pos_issue_gift_card",
        params: { amount_euros: Number.parseFloat(amountMatch[1].replace(",", ".")) },
        summary: `Émettre un bon cadeau de ${amountMatch[1]} €`,
        needsConfirm: true,
      };
    }
    return { type: "clarify", message: "Quel montant pour le bon cadeau ? (ex. « bon cadeau 50 € »)" };
  }

  if (
    has("caisse", "session") &&
    (has("etat", "état", "status", "ouverte", "resume", "résumé"))
  ) {
    return matchList(
      catalog,
      "institut.pos_session_status",
      {},
      pos.openSession ? "Résumé session caisse ouverte" : "État de la caisse",
    );
  }

  if (has("cree", "creer", "ajoute", "ajouter", "nouveau", "nouvelle")) {
    if (has("client")) {
      return { type: "clarify", message: "Pour créer un client, précisez le nom complet et l'email." };
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

async function openAiRoute(
  message: string,
  catalog: ActionCatalogEntry[],
  context: Awaited<ReturnType<typeof fetchTenantContext>>,
  pos: Awaited<ReturnType<typeof fetchPosContext>>,
): Promise<InterpretResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `Tu es l'assistant IA de BeautyHub, un SaaS pour instituts de beauté.
Tu dois choisir UNE action parmi la liste et produire les paramètres JSON.
Réponds UNIQUEMENT en JSON valide avec l'un de ces formats:
{"action":"nom.action","params":{...},"summary":"phrase courte en français"}
{"clarify":"question en français si info manquante"}
{"unknown":"message si impossible"}

Contexte tenant:
- Personnel: ${context.staff.map((s) => s.full_name).join(", ") || "aucun"}
- Cabines: ${context.resources.map((r) => r.name).join(", ") || "aucune"}
- Grilles horaires: ${context.schedules.map((s) => s.name).join(", ") || "aucune"}
- Prestations: ${context.services.map((s) => s.name).join(", ") || "aucune"}

Caisse:
- Session: ${pos.openSession ? `ouverte depuis ${pos.openSession.opened_at}` : "fermée"}
- Dernières ventes: ${pos.recentSales.map((s) => s.ticket_number ?? s.id.slice(0, 8)).join(", ") || "aucune"}
- Bons cadeaux actifs: ${pos.giftCards.map((g) => g.code).join(", ") || "aucun"}

Date du jour: ${new Date().toISOString().slice(0, 10)}

Actions disponibles:
${catalog.map((a) => `- ${a.name}: ${a.description}. Paramètres: ${a.parametersHint}${a.needsConfirm ? " [confirmation requise]" : ""}`).join("\n")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
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

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.clarify === "string") {
      return { type: "clarify", message: parsed.clarify };
    }
    if (typeof parsed.unknown === "string") {
      return { type: "unknown", message: parsed.unknown };
    }
    if (typeof parsed.action === "string") {
      const entry = catalog.find((a) => a.name === parsed.action);
      if (!entry) return { type: "unknown", message: "Action non autorisée." };
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

export async function interpretUserMessage(
  message: string,
  ctx: ExecuteActionContext,
): Promise<InterpretResult> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { type: "clarify", message: "Que souhaitez-vous faire ?" };
  }

  const actions = getAiActionsFor(ctx.enabledModuleIds, ctx.role);
  const catalog = buildCatalog(actions);
  const supabase = await createClient();
  const tenantContext = await fetchTenantContext(supabase, ctx.tenantId);
  const posContext = await fetchPosContext(supabase, ctx.tenantId);

  const llm = await openAiRoute(trimmed, catalog, tenantContext, posContext);
  if (llm) return llm;

  const heuristic = heuristicRoute(trimmed, catalog, tenantContext, posContext);
  if (heuristic) return heuristic;

  return {
    type: "unknown",
    message: process.env.OPENAI_API_KEY
      ? "Je n'ai pas compris. Reformulez ou choisissez une action rapide."
      : "Je n'ai pas compris. Ajoutez OPENAI_API_KEY pour le langage naturel avancé, ou choisissez une action rapide.",
  };
}

export function getActionMeta(actionName: string, ctx: ExecuteActionContext) {
  const actions = getAiActionsFor(ctx.enabledModuleIds, ctx.role);
  return actions.find((a) => a.name === actionName);
}
