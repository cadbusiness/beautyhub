import { getTranslations } from "next-intl/server";
import { QuotaExceededError } from "@/lib/quota";

export async function translateQuotaError(error: QuotaExceededError): Promise<string> {
  const t = await getTranslations("errors.quota");
  return t("exceeded", { key: error.key, limit: error.limit });
}
