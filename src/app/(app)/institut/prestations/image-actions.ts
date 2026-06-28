"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "service-images";
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

export async function uploadServiceImage(
  serviceId: string,
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
  const { data: service } = await supabase
    .from("inst_services")
    .select("id")
    .eq("id", serviceId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!service) return { error: "Prestation introuvable." };

  const path = `${session.tenant.id}/${serviceId}/${crypto.randomUUID()}.${extForMime(file.type)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbErr } = await supabase
    .from("inst_services")
    .update({ image_url: publicUrl })
    .eq("id", serviceId)
    .eq("tenant_id", session.tenant.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/institut/prestations");
  revalidatePath("/reserver");
  return { url: publicUrl };
}

export async function removeServiceImage(serviceId: string): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("inst_services")
    .select("image_url")
    .eq("id", serviceId)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!service?.image_url) return { ok: true };

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = service.image_url.indexOf(marker);
  if (idx >= 0) {
    const storagePath = service.image_url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from("inst_services")
    .update({ image_url: null })
    .eq("id", serviceId)
    .eq("tenant_id", session.tenant.id);
  if (error) return { error: error.message };

  revalidatePath("/institut/prestations");
  revalidatePath("/reserver");
  return { ok: true };
}
