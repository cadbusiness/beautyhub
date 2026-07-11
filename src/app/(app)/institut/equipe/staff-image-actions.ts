"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "staff-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function uploadStaffAvatar(
  staffId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const session = await requireModule("institut");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Fichier requis." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image trop volumineuse (max 5 Mo)." };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: "Format non supporté (JPEG, PNG, WebP, GIF)." };
  }

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("inst_staff")
    .select("id, avatar_url")
    .eq("id", staffId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!staff) return { error: "Membre introuvable." };

  const path = `${session.tenant.id}/${staffId}/${crypto.randomUUID()}.${extForMime(file.type)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  if (staff.avatar_url) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = staff.avatar_url.indexOf(marker);
    if (idx >= 0) {
      await supabase.storage.from(BUCKET).remove([staff.avatar_url.slice(idx + marker.length)]);
    }
  }

  const { error: dbErr } = await supabase
    .from("inst_staff")
    .update({ avatar_url: publicUrl })
    .eq("id", staffId)
    .eq("tenant_id", session.tenant.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/institut/equipe");
  revalidatePath("/institut/rendez-vous");
  return { url: publicUrl };
}

export async function removeStaffAvatar(
  staffId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("inst_staff")
    .select("avatar_url")
    .eq("id", staffId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!staff?.avatar_url) return { ok: true };

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = staff.avatar_url.indexOf(marker);
  if (idx >= 0) {
    await supabase.storage.from(BUCKET).remove([staff.avatar_url.slice(idx + marker.length)]);
  }

  const { error } = await supabase
    .from("inst_staff")
    .update({ avatar_url: null })
    .eq("id", staffId)
    .eq("tenant_id", session.tenant.id);
  if (error) return { error: error.message };

  revalidatePath("/institut/equipe");
  revalidatePath("/institut/rendez-vous");
  return { ok: true };
}
