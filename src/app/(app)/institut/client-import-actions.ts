"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { translateQuotaError } from "@/lib/i18n/quota";
import {
  fetchExistingOvercacheClients,
  parseOvercacheCsv,
  previewOvercacheImport,
  runOvercacheImport,
  type OvercacheImportPreview,
  type OvercacheImportResult,
} from "@/lib/institut/client-import/overcache-csv";

export type ClientImportActionResult = {
  ok?: boolean;
  error?: string;
  preview?: OvercacheImportPreview;
  result?: OvercacheImportResult;
  quotaLimit?: number | null;
  quotaUsage?: number;
};

export async function previewOvercacheImportAction(
  _prev: ClientImportActionResult,
  formData: FormData,
): Promise<ClientImportActionResult> {
  const t = await getTranslations("institut.clients.import");
  const session = await requireModule("institut");
  const csvContent = String(formData.get("csv_content") ?? "");
  if (!csvContent.trim()) return { error: t("errors.emptyFile") };

  const { rows, errors: parseErrors } = parseOvercacheCsv(csvContent);
  if (parseErrors.includes("missing_columns")) {
    return { error: t("errors.missingColumns") };
  }
  if (parseErrors.length > 0 && rows.length === 0) {
    return { error: t("errors.invalidFile") };
  }

  const supabase = await createClient();
  const existingByRef = await fetchExistingOvercacheClients(supabase, session.tenant.id);
  const preview = previewOvercacheImport(rows, session.tenant.slug, existingByRef);

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", session.tenant.id);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plans(limits)")
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  const limits = (sub?.plans as { limits?: Record<string, unknown> } | null)?.limits;
  const quotaLimit =
    limits && typeof limits.clients === "number" ? limits.clients : null;

  return {
    preview,
    quotaLimit,
    quotaUsage: count ?? 0,
  };
}

export async function importOvercacheClientsAction(
  _prev: ClientImportActionResult,
  formData: FormData,
): Promise<ClientImportActionResult> {
  const t = await getTranslations("institut.clients.import");
  const session = await requireModule("institut");
  const csvContent = String(formData.get("csv_content") ?? "");
  const confirm = String(formData.get("confirm") ?? "") === "1";
  if (!confirm) return { error: t("errors.confirmRequired") };
  if (!csvContent.trim()) return { error: t("errors.emptyFile") };

  const { rows, errors: parseErrors } = parseOvercacheCsv(csvContent);
  if (parseErrors.includes("missing_columns")) {
    return { error: t("errors.missingColumns") };
  }
  if (rows.length === 0) return { error: t("errors.invalidFile") };

  const supabase = await createClient();
  const existingByRef = await fetchExistingOvercacheClients(supabase, session.tenant.id);
  const preview = previewOvercacheImport(rows, session.tenant.slug, existingByRef);

  try {
    await assertQuota(session.tenant.id, "clients", preview.toCreate);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return { error: await translateQuotaError(e), preview };
    }
    throw e;
  }

  const result = await runOvercacheImport(
    supabase,
    session.tenant.id,
    session.tenant.slug,
    rows,
  );

  if (result.errors.length > 0 && result.created === 0 && result.updated === 0) {
    return { error: result.errors[0] ?? t("errors.importFailed"), preview, result };
  }

  revalidatePath("/institut/clients");
  return { ok: true, preview, result };
}
