"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchExistingBooklyCatalog,
  parseBooklyServicesCsv,
  previewBooklyImport,
  runBooklyServicesImport,
  type BooklyImportPreview,
  type BooklyImportResult,
} from "@/lib/institut/service-import/bookly-csv";

export type ServiceImportActionResult = {
  ok?: boolean;
  error?: string;
  preview?: BooklyImportPreview;
  result?: BooklyImportResult;
};

export async function previewBooklyServicesImportAction(
  _prev: ServiceImportActionResult,
  formData: FormData,
): Promise<ServiceImportActionResult> {
  const t = await getTranslations("institut.services.import");
  const session = await requireModule("institut");
  const csvContent = String(formData.get("csv_content") ?? "");
  if (!csvContent.trim()) return { error: t("errors.emptyFile") };

  const { rows, errors: parseErrors } = parseBooklyServicesCsv(csvContent);
  if (parseErrors.includes("missing_columns")) {
    return { error: t("errors.missingColumns") };
  }
  if (parseErrors.includes("empty_file") || rows.length === 0) {
    return { error: t("errors.invalidFile") };
  }

  const supabase = await createClient();
  const existing = await fetchExistingBooklyCatalog(supabase, session.tenant.id);
  const preview = previewBooklyImport(rows, existing);
  return { preview };
}

export async function importBooklyServicesAction(
  _prev: ServiceImportActionResult,
  formData: FormData,
): Promise<ServiceImportActionResult> {
  const t = await getTranslations("institut.services.import");
  const session = await requireModule("institut");
  const csvContent = String(formData.get("csv_content") ?? "");
  const confirm = String(formData.get("confirm") ?? "") === "1";
  if (!confirm) return { error: t("errors.confirmRequired") };
  if (!csvContent.trim()) return { error: t("errors.emptyFile") };

  const { rows, errors: parseErrors } = parseBooklyServicesCsv(csvContent);
  if (parseErrors.includes("missing_columns")) {
    return { error: t("errors.missingColumns") };
  }
  if (rows.length === 0) return { error: t("errors.invalidFile") };

  const supabase = await createClient();
  const result = await runBooklyServicesImport(supabase, session.tenant.id, rows);

  if (result.errors.length > 0 && result.created === 0 && result.updated === 0) {
    return { error: result.errors[0] ?? t("errors.importFailed"), result };
  }

  revalidatePath("/institut/prestations");
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/rendez-vous");
  revalidatePath("/reserver");
  return { ok: true, result };
}
