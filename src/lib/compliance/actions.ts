"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  canManageInstitutSettings,
  requireInstitutSettingsModule,
} from "@/lib/auth/institut-settings";
import { requireModule } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/compliance/audit";
import { anonymizeClient } from "@/lib/compliance/anonymize";
import { recordConsentEvent } from "@/lib/compliance/consent";
import {
  clientExportFilename,
  exportClientData,
  serializeClientExport,
} from "@/lib/compliance/export";
import {
  COMPLIANCE_CHECKLIST_KEYS,
  parseTenantCompliance,
  type ComplianceChecklistKey,
} from "@/lib/compliance/tenant-compliance";

export type ComplianceActionResult = { error?: string; ok?: boolean };

export async function exportClientDataAction(
  clientId: string,
): Promise<{ error?: string; json?: string; filename?: string }> {
  const t = await getTranslations("compliance.actions");
  const session = await requireModule("institut");
  const user = await getCurrentUser();
  const supabase = await createClient();

  const data = await exportClientData(supabase, session.tenant.id, clientId);
  if (!data) return { error: t("clientNotFound") };

  await logAuditEvent(supabase, {
    tenantId: session.tenant.id,
    actorType: "team",
    actorId: user?.id,
    actorEmail: user?.email,
    action: "client.data_export",
    resourceType: "client",
    resourceId: clientId,
  });

  return {
    json: serializeClientExport(data),
    filename: clientExportFilename(clientId),
  };
}

export async function anonymizeClientAction(
  clientId: string,
): Promise<ComplianceActionResult> {
  const t = await getTranslations("compliance.actions");
  const session = await requireModule("institut");
  if (!canManageInstitutSettings(session.role, session.enabledModuleIds)) {
    return { error: t("forbidden") };
  }
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("id, metadata")
    .eq("tenant_id", session.tenant.id)
    .eq("id", clientId)
    .maybeSingle();

  if (!existing) return { error: t("clientNotFound") };

  const result = await anonymizeClient(supabase, session.tenant.id, clientId);
  if (!result.ok) return { error: result.error };

  await recordConsentEvent(supabase, {
    tenantId: session.tenant.id,
    clientId,
    consentType: "privacy",
    granted: false,
    source: "anonymization",
    actorType: "staff",
    actorId: user?.id ?? null,
  });

  await logAuditEvent(supabase, {
    tenantId: session.tenant.id,
    actorType: "team",
    actorId: user?.id,
    actorEmail: user?.email,
    action: "client.anonymized",
    resourceType: "client",
    resourceId: clientId,
  });

  revalidatePath("/institut/clients");
  revalidatePath(`/institut/clients/${clientId}`);
  return { ok: true };
}

export async function toggleComplianceChecklistItem(
  key: ComplianceChecklistKey,
  checked: boolean,
): Promise<ComplianceActionResult> {
  const session = await requireInstitutSettingsModule();
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (!COMPLIANCE_CHECKLIST_KEYS.includes(key)) {
    return { error: "invalid_key" };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("compliance")
    .eq("id", session.tenant.id)
    .single();

  const current = parseTenantCompliance(tenant?.compliance);
  const next = { ...current };
  if (checked) {
    next[key] = new Date().toISOString();
  } else {
    delete next[key];
  }

  const { error } = await supabase
    .from("tenants")
    .update({ compliance: next })
    .eq("id", session.tenant.id);

  if (error) return { error: error.message };

  await logAuditEvent(supabase, {
    tenantId: session.tenant.id,
    actorType: "team",
    actorId: user?.id,
    actorEmail: user?.email,
    action: checked ? "compliance.checklist_done" : "compliance.checklist_undone",
    resourceType: "tenant",
    resourceId: session.tenant.id,
    metadata: { key },
  });

  revalidatePath("/compte/institut/conformite");
  return { ok: true };
}

export async function saveDataRetentionDays(
  days: number | null,
): Promise<ComplianceActionResult> {
  const session = await requireInstitutSettingsModule();
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (days !== null && (days < 30 || days > 3650)) {
    return { error: "invalid_retention" };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ data_retention_days: days })
    .eq("id", session.tenant.id);

  if (error) return { error: error.message };

  await logAuditEvent(supabase, {
    tenantId: session.tenant.id,
    actorType: "team",
    actorId: user?.id,
    actorEmail: user?.email,
    action: "compliance.retention_updated",
    resourceType: "tenant",
    resourceId: session.tenant.id,
    metadata: { days },
  });

  revalidatePath("/compte/institut/conformite");
  return { ok: true };
}
