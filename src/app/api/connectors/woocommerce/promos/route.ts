import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redeemPromo, validatePromo } from "@/lib/institut/promos-core";
import {
  resolveWooWebhookConnection,
  verifyWebhookSignature,
} from "@/lib/woocommerce";

interface PromoBridgeBody {
  action?: "validate" | "confirm";
  code?: string;
  total_cents?: number;
  currency?: string;
  order_id?: number;
  idempotency_key?: string;
  cart_hash?: string;
  amount_cents?: number;
}

function normalizeCode(code: string | undefined): string {
  return String(code ?? "").trim().toUpperCase();
}

export async function POST(request: Request) {
  const token = request.headers.get("x-beautyhub-token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }
  const connection = await resolveWooWebhookConnection(token);
  if (!connection) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-beautyhub-signature");
  if (!verifyWebhookSignature(rawBody, signature, connection.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: PromoBridgeBody;
  try {
    body = JSON.parse(rawBody) as PromoBridgeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = normalizeCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (body.action === "confirm") {
    const amountCents = Math.max(
      1,
      Math.round(Number(body.amount_cents ?? body.total_cents ?? 0)),
    );
    const orderId = Number(body.order_id ?? 0) || null;
    const idempotencyKey =
      body.idempotency_key?.trim() ||
      `woo:order:${orderId ?? "unknown"}:promo:${code}:${amountCents}`;

    try {
      const redeemed = await redeemPromo(supabase, connection.tenantId, {
        code,
        channel: "woo",
        amountCents,
        wooOrderId: orderId,
        idempotencyKey,
        metadata: {
          cart_hash: body.cart_hash ?? null,
          currency: body.currency ?? "eur",
        },
      });
      return NextResponse.json({
        ok: true,
        promo_id: redeemed.promoId,
        amount_cents: redeemed.amountCents,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: (e as Error).message },
        { status: 400 },
      );
    }
  }

  const totalCents = Math.max(0, Math.round(Number(body.total_cents ?? 0)));
  const validated = await validatePromo(supabase, connection.tenantId, {
    code,
    channel: "woo",
    subtotalCents: totalCents,
  });

  if (!validated.valid || !validated.promo) {
    return NextResponse.json(
      {
        valid: false,
        error: validated.error ?? "promo_invalid",
        discount_cents: 0,
      },
      { status: validated.error === "promo_not_found" ? 404 : 200 },
    );
  }

  return NextResponse.json({
    valid: true,
    promo_id: validated.promo.id,
    code: validated.promo.code,
    discount_cents: validated.discount_cents,
    discount_type: validated.promo.discount_type,
  });
}
