"use server";

import { getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/auth/guards";
import { executeAction } from "@/lib/ai/runtime";
import { interpretUserMessage, type InterpretResult } from "@/lib/ai/nl-router";
import type { ExecuteActionResult } from "@/lib/ai/types";
import { createSupportTicket } from "@/lib/platform/support";
import type { SupportCategory } from "@/lib/platform/support";

export type RunAiActionResult = ExecuteActionResult;

export type InterpretMessageResult = InterpretResult;

export type SubmitSupportTicketResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

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

export async function submitSupportTicket(input: {
  subject: string;
  body: string;
  category: SupportCategory;
  aiSummary?: string;
  conversationExcerpt?: string;
  pageUrl?: string;
}): Promise<SubmitSupportTicketResult> {
  const session = await requireTenantSession();
  const t = await getTranslations("assistant.panel.support");

  const result = await createSupportTicket({
    tenantId: session.tenant.id,
    userId: session.userId,
    subject: input.subject,
    body: input.body,
    category: input.category,
    aiSummary: input.aiSummary,
    conversationExcerpt: input.conversationExcerpt,
    pageUrl: input.pageUrl,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? t("submitError") };
  }

  return { ok: true, ticketId: result.id };
}
