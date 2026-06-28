"use server";

import { getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/auth/guards";
import { executeAction } from "@/lib/ai/runtime";
import { interpretUserMessage, type InterpretResult } from "@/lib/ai/nl-router";
import type { ExecuteActionResult } from "@/lib/ai/types";

export type RunAiActionResult = ExecuteActionResult;

export type InterpretMessageResult = InterpretResult;

function sessionContext(session: Awaited<ReturnType<typeof requireTenantSession>>) {
  return {
    tenantId: session.tenant.id,
    userId: session.userId,
    role: session.role,
    enabledModuleIds: session.enabledModuleIds,
  };
}

export async function runAiAction(
  actionName: string,
  paramsJson: string,
  options?: { confirmed?: boolean },
): Promise<RunAiActionResult> {
  const session = await requireTenantSession();
  const actions = await getTranslations("institut.actions");

  let params: unknown;
  try {
    params = paramsJson.trim() ? JSON.parse(paramsJson) : {};
  } catch {
    return { ok: false, error: actions("invalidJsonParams") };
  }

  return executeAction(actionName, params, sessionContext(session), options);
}

export async function interpretMessage(message: string): Promise<InterpretMessageResult> {
  const session = await requireTenantSession();
  return interpretUserMessage(message, sessionContext(session));
}
