import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  createPosCart,
  ensureActivePosCart,
  listOpenPosCarts,
} from "@/lib/institut/pos-carts";
import {
  posCartErrorResponse,
  posCartWriteSchema,
  writeInputFromBody,
} from "@/lib/institut/pos-carts-http";

export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const ensure = url.searchParams.get("ensure") === "1";
    if (ensure) {
      const result = await ensureActivePosCart(
        session.supabase,
        session.tenant.id,
        session.user.id,
      );
      return Response.json(result);
    }
    const carts = await listOpenPosCarts(
      session.supabase,
      session.tenant.id,
      session.user.id,
    );
    return Response.json({ carts });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const raw = await request.json().catch(() => ({}));
    const parsed = posCartWriteSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: parsed.error.message },
        { status: 400 },
      );
    }
    const cart = await createPosCart(
      session.supabase,
      session.tenant.id,
      session.user.id,
      writeInputFromBody(parsed.data),
    );
    return Response.json({ cart });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      return posCartErrorResponse(error);
    }
    return mobileErrorResponse(error);
  }
}
