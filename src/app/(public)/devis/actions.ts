"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type QuoteRespondResult = { ok?: boolean; error?: string };

export async function respondToPublicQuote(
  token: string,
  action: "accept" | "decline",
): Promise<QuoteRespondResult> {
  const t = await getTranslations("public.quote");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_public_quote", {
    p_token: token,
    p_action: action,
  });
  if (error) return { error: error.message || t("respondError") };
  revalidatePath(`/devis/${token}`);
  return { ok: true };
}
