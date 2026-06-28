"use server";

import { getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/auth/guards";
import { executeAction } from "@/lib/ai/runtime";
import type { ExecuteActionResult } from "@/lib/ai/types";

export type RunAiActionResult = ExecuteActionResult;

export async function runAiAction(
  actionName: string,
  paramsJson: string,
): Promise<RunAiActionResult> {
  const session = await requireTenantSession();
  const actions = await getTranslations("institut.actions");

  let params: unknown;
  try {
    params = paramsJson.trim() ? JSON.parse(paramsJson) : {};
  } catch {
    return { ok: false, error: actions("invalidJsonParams") };
  }

  return executeAction(actionName, params, {
    tenantId: session.tenant.id,
    userId: session.userId,
    role: session.role,
    enabledModuleIds: session.enabledModuleIds,
  });
}
