import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import { uploadTenantLogo } from "@/lib/institut/tenant-branding";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json(
        { error: "file_required", message: "Fichier requis." },
        { status: 400 },
      );
    }

    const result = await uploadTenantLogo(
      session.supabase,
      session.tenant.id,
      file,
    );

    if (result.error) {
      const message =
        result.error === "logo_images_only"
          ? "Seules les images sont acceptées."
          : result.error === "unsupportedFormat"
            ? "Format non supporté."
            : result.error === "imageTooLarge"
              ? "Image trop volumineuse (max 5 Mo)."
              : result.error;
      return Response.json(
        { error: result.error, message },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, logoUrl: result.logoUrl });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
