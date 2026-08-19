import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
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
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const url = new URL(request.url);
    const ensure = url.searchParams.get("ensure") === "1";
    if (ensure) {
      const result = await ensureActivePosCart(
        supabase,
        session.tenant.id,
        session.userId,
      );
      return Response.json(result);
    }
    const carts = await listOpenPosCarts(
      supabase,
      session.tenant.id,
      session.userId,
    );
    return Response.json({ carts });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const supabase = await createClient();
    const raw = await request.json().catch(() => ({}));
    const parsed = posCartWriteSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_body", message: parsed.error.message },
        { status: 400 },
      );
    }
    const cart = await createPosCart(
      supabase,
      session.tenant.id,
      session.userId,
      writeInputFromBody(parsed.data),
    );
    return Response.json({ cart });
  } catch (error) {
    return posCartErrorResponse(error);
  }
}
