import { getAiActionsFor } from "@/modules";
import type { ActionContext } from "@/modules/types";
import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import type { ExecuteActionContext, ExecuteActionResult } from "./types";

/**
 * Execute une action IA declaree par un module actif.
 * Valide les parametres (zod), verifie les quotas, puis appelle le handler.
 */
export async function executeAction(
  actionName: string,
  params: unknown,
  ctx: ExecuteActionContext,
  options?: { confirmed?: boolean },
): Promise<ExecuteActionResult> {
  const actions = getAiActionsFor(ctx.enabledModuleIds, ctx.role);
  const action = actions.find((a) => a.name === actionName);
  if (!action) {
    return {
      ok: false,
      error: `Action inconnue ou non autorisee : ${actionName}`,
    };
  }

  if (action.confirm && !options?.confirmed) {
    return {
      ok: false,
      error: "CONFIRMATION_REQUIRED",
      needsConfirm: true,
    };
  }

  const parsed = action.parameters.safeParse(params);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, error: msg || "Parametres invalides." };
  }

  if (action.quotaKey) {
    try {
      await assertQuota(ctx.tenantId, action.quotaKey);
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }

  const supabase = await createClient();
  const actionCtx: ActionContext = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: ctx.role,
    supabase,
  };

  try {
    const data = await action.handler(actionCtx, parsed.data);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
