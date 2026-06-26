"use server";

import { requireTenantSession } from "@/lib/auth/guards";
import { executeAction } from "@/lib/ai/runtime";
import type { ExecuteActionResult } from "@/lib/ai/types";

export type RunAiActionResult = ExecuteActionResult;

export async function runAiAction(
  actionName: string,
  paramsJson: string,
): Promise<RunAiActionResult> {
  const session = await requireTenantSession();

  let params: unknown;
  try {
    params = paramsJson.trim() ? JSON.parse(paramsJson) : {};
  } catch {
    return { ok: false, error: "JSON invalide pour les parametres." };
  }

  return executeAction(actionName, params, {
    tenantId: session.tenant.id,
    userId: session.userId,
    role: session.role,
    enabledModuleIds: session.enabledModuleIds,
  });
}
