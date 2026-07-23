"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/db/database.types";
import { VOUCHER_ASSETS_BUCKET } from "@/lib/institut/voucher-pdf";

const BON_PATH = "/institut/caisse/bons";

export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function saveVoucherTemplate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const t = await getTranslations("pos.vouchers.templates.actions");

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || "Carte cadeau";
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const footerText = String(formData.get("footer_text") ?? "").trim();
  const isActive = formData.get("is_active") === "1";
  const isDefault = formData.get("is_default") === "1";

  if (!name) return { error: t("nameRequired") };

  let backgroundPath: string | null | undefined;
  const file = formData.get("background");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.has(file.type)) return { error: t("invalidImage") };
    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${session.tenant.id}/bg-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(VOUCHER_ASSETS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { error: upErr.message };
    backgroundPath = path;
  }

  if (isDefault) {
    await supabase
      .from("inst_voucher_templates")
      .update({ is_default: false })
      .eq("tenant_id", session.tenant.id)
      .neq("id", id || "00000000-0000-0000-0000-000000000000");
  }

  const payload = {
    name,
    title,
    subtitle,
    footer_text: footerText,
    is_active: isActive,
    is_default: isDefault,
    ...(backgroundPath !== undefined ? { background_path: backgroundPath } : {}),
  };

  if (id) {
    const { error } = await supabase
      .from("inst_voucher_templates")
      .update(payload)
      .eq("tenant_id", session.tenant.id)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("inst_voucher_templates").insert({
      tenant_id: session.tenant.id,
      layout: {
        code: { x: 50, y: 62 },
        amount: { x: 50, y: 42 },
        recipient: { x: 50, y: 28 },
        message: { x: 50, y: 78 },
      } as Json,
      ...payload,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(BON_PATH);
  return { ok: true, message: t("saved") };
}

export async function deleteVoucherTemplate(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const { data } = await supabase
    .from("inst_voucher_templates")
    .select("background_path")
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("inst_voucher_templates")
    .delete()
    .eq("tenant_id", session.tenant.id)
    .eq("id", id);

  if (data?.background_path) {
    await supabase.storage.from(VOUCHER_ASSETS_BUCKET).remove([data.background_path]);
  }

  revalidatePath(BON_PATH);
}
