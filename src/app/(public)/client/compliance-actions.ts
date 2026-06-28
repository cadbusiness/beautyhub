"use server";

import { getTranslations } from "next-intl/server";
import { clearClientSession, getClientSession } from "@/lib/client-auth/session";
import { logAuditEvent } from "@/lib/compliance/audit";
import { anonymizeClient } from "@/lib/compliance/anonymize";
import { recordConsentEvent } from "@/lib/compliance/consent";
import { getTenantContext } from "@/lib/tenant/context";
import { createServiceClient } from "@/lib/supabase/service";

export async function requestClientErasure(): Promise<{ error?: string; ok?: boolean }> {
  const t = await getTranslations("compliance.actions");
  const tenant = await getTenantContext();
  if (!tenant) return { error: t("tenantNotFound") };

  const session = await getClientSession(tenant.id);
  if (!session) return { error: t("unauthorized") };

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return { error: t("serverConfig") };
  }

  const result = await anonymizeClient(supabase, tenant.id, session.clientId);
  if (!result.ok) return { error: result.error };

  await recordConsentEvent(supabase, {
    tenantId: tenant.id,
    clientId: session.clientId,
    consentType: "privacy",
    granted: false,
    source: "portal_erasure",
    actorType: "client",
    actorId: session.clientId,
  });

  await logAuditEvent(supabase, {
    tenantId: tenant.id,
    actorType: "client",
    actorId: session.clientId,
    actorEmail: session.email,
    action: "client.self_anonymized",
    resourceType: "client",
    resourceId: session.clientId,
  });

  await clearClientSession();
  return { ok: true };
}
