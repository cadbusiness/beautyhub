import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  abandonPosCart,
  getPosCart,
  updatePosCart,
} from "@/lib/institut/pos-carts";
import {
  posCartErrorResponse,
  posCartWriteSchema,
  writeInputFromBody,
} from "@/lib/institut/pos-carts-http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const cart = await getPosCart(
      session.supabase,
      session.tenant.id,
      id,
      session.user.id,
    );
    return Response.json({ cart });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const parsed = posCartWriteSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: parsed.error.message },
        { status: 400 },
      );
    }
    const cart = await updatePosCart(
      session.supabase,
      session.tenant.id,
      id,
      session.user.id,
      writeInputFromBody(parsed.data),
      { force: parsed.data.force === true },
    );
    return Response.json({ cart });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    await abandonPosCart(
      session.supabase,
      session.tenant.id,
      id,
      session.user.id,
      { force },
    );
    return Response.json({ ok: true });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}
