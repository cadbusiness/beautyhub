import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  createProductCategory,
  parseMobileProductCategoryBody,
} from "@/lib/institut/internal-products";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const raw = await request.json().catch(() => ({}));
    const parsed = parseMobileProductCategoryBody(raw);
    if ("error" in parsed) {
      return Response.json(
        { error: parsed.error, message: "Nom requis" },
        { status: 400 },
      );
    }

    const item = await createProductCategory(
      session.supabase,
      session.tenant.id,
      parsed,
    );
    return Response.json(
      {
        item: {
          id: item.id,
          name: item.name,
          sortOrder: item.sort_order,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
