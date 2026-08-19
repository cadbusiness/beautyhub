import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
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
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const { id } = await params;
    const cart = await getPosCart(supabase, session.tenant.id, id, session.userId);
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
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
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
      supabase,
      session.tenant.id,
      id,
      session.userId,
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
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    await abandonPosCart(supabase, session.tenant.id, id, session.userId, {
      force,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}
