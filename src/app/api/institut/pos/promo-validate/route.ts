import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { validatePromo } from "@/lib/institut/promos-core";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim() ?? "";
  const subtotalCents = Math.max(0, Math.round(Number(params.get("subtotal_cents") ?? 0)));
  const clientId = params.get("client_id")?.trim() || null;

  if (!code) {
    return NextResponse.json({ valid: false, error: "promo_code_required", discount_cents: 0 });
  }

  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const result = await validatePromo(supabase, session.tenant.id, {
      code,
      channel: "pos",
      subtotalCents,
      clientId,
    });
    return NextResponse.json({
      valid: result.valid,
      error: result.error ?? null,
      discount_cents: result.discount_cents,
      code: result.promo?.code ?? null,
    });
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[pos/promo-validate]", error);
    return NextResponse.json({ valid: false, error: "load_failed", discount_cents: 0 }, { status: 500 });
  }
}
