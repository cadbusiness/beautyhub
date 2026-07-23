import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/tenant/context";
import { validatePromo } from "@/lib/institut/promos-core";

export async function GET(request: Request) {
  const tenant = await getTenantContext();
  if (!tenant) {
    return NextResponse.json({ valid: false, error: "tenant_not_found", discount_cents: 0 }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim() ?? "";
  const subtotalCents = Math.max(0, Math.round(Number(params.get("subtotal_cents") ?? 0)));

  if (!code) {
    return NextResponse.json({ valid: false, error: "promo_code_required", discount_cents: 0 });
  }

  const supabase = createServiceClient();
  const result = await validatePromo(supabase, tenant.id, {
    code,
    channel: "booking",
    subtotalCents,
  });

  return NextResponse.json({
    valid: result.valid,
    error: result.error ?? null,
    discount_cents: result.discount_cents,
    code: result.promo?.code ?? null,
  });
}
