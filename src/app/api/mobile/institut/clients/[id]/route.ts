import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  parseMobileClientBody,
  updateMobileClient,
} from "@/lib/institut/mobile-clients";

/**
 * PATCH /api/mobile/institut/clients/[id]
 * Met à jour une fiche cliente (contact, adresse, notes, marketing…).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await context.params;
    if (!id) {
      return Response.json(
        { error: "not_found", message: "Cliente introuvable." },
        { status: 404 },
      );
    }
    const raw = await request.json().catch(() => ({}));
    const result = await updateMobileClient(
      session.supabase,
      session.tenant.id,
      id,
      session.user.id,
      parseMobileClientBody(raw),
    );

    if ("error" in result) {
      return Response.json(
        { error: result.code, message: result.error },
        { status: result.status },
      );
    }

    return Response.json({ item: result.item, account: result.account });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
