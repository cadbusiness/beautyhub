import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  createInternalProductRecord,
  parseMobileInternalProductBody,
} from "@/lib/institut/internal-products";

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const raw = await request.json().catch(() => ({}));
    const parsed = parseMobileInternalProductBody(raw);
    if ("error" in parsed) {
      return Response.json(
        { error: parsed.error, message: "Nom requis" },
        { status: 400 },
      );
    }

    const item = await createInternalProductRecord(
      session.supabase,
      session.tenant.id,
      parsed,
    );
    return Response.json(
      {
        item: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          priceCents: item.price_cents,
          stockQuantity: item.stock_quantity,
          categoryId: item.category_id,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
