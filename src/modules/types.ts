import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export type TeamRole =
  | "platform_admin"
  | "brand_owner"
  | "tenant_owner"
  | "staff"
  | "coach";

export type ModuleId = string;

/** Entree de navigation injectee dans le back-office quand le module est actif. */
export interface ModuleNavItem {
  label: string;
  href: string;
  icon?: string;
  /** Roles autorises a voir/utiliser l'entree (vide = tous les roles equipe). */
  roles?: TeamRole[];
}

/**
 * Contexte transmis au handler d'une action (humaine ou IA).
 * Toujours scope a un tenant precis.
 */
export interface ActionContext {
  tenantId: string;
  userId: string;
  role: TeamRole;
  supabase: SupabaseClient<Database>;
}

/**
 * Action IA declaree par un module. L'assistant agrege automatiquement
 * les actions de tous les modules actives du tenant (pas de cablage manuel).
 */
export interface AIAction<TParams = unknown, TResult = unknown> {
  /** Identifiant stable, prefixe par le module, ex: "institut.create_service". */
  name: string;
  description: string;
  /** Schema zod des parametres -> sert aussi a generer le JSON schema pour le LLM. */
  parameters: z.ZodType<TParams>;
  /** Role minimum requis pour executer l'action. */
  requiredRole?: TeamRole;
  /** Cle de quota a verifier avant execution (ex: "appointments_per_month"). */
  quotaKey?: string;
  /** true => demande confirmation explicite avant execution (garde-fou). */
  confirm?: boolean;
  handler: (ctx: ActionContext, params: TParams) => Promise<TResult>;
}

/**
 * Definit une action IA en inferant le type des parametres depuis le schema zod.
 * Le handler recoit des params typees, tout en restant stockable comme AIAction.
 */
export function defineAction<S extends z.ZodType>(action: {
  name: string;
  description: string;
  parameters: S;
  requiredRole?: TeamRole;
  quotaKey?: string;
  confirm?: boolean;
  handler: (ctx: ActionContext, params: z.infer<S>) => Promise<unknown>;
}): AIAction {
  return action as AIAction;
}

/** Contrat de module: tout ce qu'un module declare au coeur de la plateforme. */
export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  category?: string;
  version: string;
  /** Entrees de navigation du back-office. */
  nav?: ModuleNavItem[];
  /** Permissions custom exposees par le module. */
  permissions?: string[];
  /** Actions exposees a l'assistant IA. */
  aiActions?: AIAction[];
}
