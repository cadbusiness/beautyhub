import type { TeamRole } from "@/modules/types";

/** Contexte minimal pour executer une action IA cote serveur. */
export interface ExecuteActionContext {
  tenantId: string;
  userId: string;
  role: TeamRole;
  enabledModuleIds: string[];
}

export type ExecuteActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; needsConfirm?: boolean };
