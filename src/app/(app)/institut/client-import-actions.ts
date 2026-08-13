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
};

export async function importOvercacheClientsAction(
  _prev: ClientImportActionResult,
  formData: FormData,
): Promise<ClientImportActionResult> {
  const t = await getTranslations("institut.clients.import");

  try {
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

    const limitRaw = String(formData.get("limit") ?? "").trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const importLimit = Number.isFinite(limit) && (limit as number) > 0 ? limit : undefined;

    const supabase = await createClient();
    const existingByRef = await fetchExistingOvercacheClients(supabase, session.tenant.id);
    const preview = previewOvercacheImport(
      rows,
      session.tenant.slug,
      existingByRef,
    );

    const quotaIncrement = importLimit
      ? Math.min(importLimit, preview.toCreate)
      : preview.toCreate;

    try {
      await assertQuota(session.tenant.id, "clients", quotaIncrement);
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
      { limit: importLimit },
    );

    if (result.errors.length > 0 && result.created === 0 && result.updated === 0) {
      return { error: result.errors[0] ?? t("errors.importFailed"), preview, result };
    }

    revalidatePath("/institut/clients");
    return { ok: true, preview, result };
  } catch (error) {
    console.error("[importOvercacheClientsAction]", error);
    return { error: t("errors.importFailed") };
  }
}
