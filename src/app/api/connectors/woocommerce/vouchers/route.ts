import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getVoucherByCode, redeemVoucher } from "@/lib/institut/vouchers-core";
import {
  resolveWooWebhookConnection,
  verifyWebhookSignature,
} from "@/lib/woocommerce";

interface VoucherBridgeBody {
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

  let body: VoucherBridgeBody;
  try {
    body = JSON.parse(rawBody) as VoucherBridgeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = normalizeCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const voucher = await getVoucherByCode(supabase, connection.tenantId, code);
  if (!voucher) {
    return NextResponse.json({ valid: false, error: "voucher_not_found" }, { status: 404 });
  }

  if (body.action === "confirm") {
    const amountCents = Math.max(
      1,
      Math.round(Number(body.amount_cents ?? body.total_cents ?? 0)),
    );
    const orderId = Number(body.order_id ?? 0) || null;
    const idempotencyKey =
      body.idempotency_key?.trim() ||
      `woo:order:${orderId ?? "unknown"}:voucher:${code}:${amountCents}`;

    try {
      const redeemed = await redeemVoucher(supabase, connection.tenantId, {
        code,
        amountCents,
        sourceChannel: "woo",
        wooOrderId: orderId,
        wooCouponCode: code,
        idempotencyKey,
        metadata: {
          cart_hash: body.cart_hash ?? null,
        },
      });
      await supabase.from("inst_voucher_links").insert({
        tenant_id: connection.tenantId,
        voucher_id: redeemed.voucherId,
        woo_order_id: orderId,
        woo_coupon_code: code,
      });
      return NextResponse.json({
        ok: true,
        voucher_id: redeemed.voucherId,
        remaining_cents: redeemed.remainingCents,
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: (e as Error).message },
        { status: 400 },
      );
    }
  }

  const totalCents = Math.max(0, Math.round(Number(body.total_cents ?? 0)));
  const discountCents = Math.min(voucher.current_balance_cents, totalCents);
  const reserveToken = randomUUID();

  await supabase.from("inst_voucher_events").insert({
    tenant_id: connection.tenantId,
    voucher_id: voucher.id,
    event_type: "sync",
    amount_cents: 0,
    balance_after_cents: voucher.current_balance_cents,
    source_channel: "woo",
    idempotency_key: `woo:validate:${reserveToken}`,
    metadata: {
      reserve_token: reserveToken,
      cart_hash: body.cart_hash ?? null,
      currency: body.currency ?? "eur",
    },
  });

  return NextResponse.json({
    valid: voucher.status === "active" && discountCents > 0,
    voucher_id: voucher.id,
    code: voucher.code,
    discount_cents: discountCents,
    reserve_token: reserveToken,
    status: voucher.status,
    remaining_cents: voucher.current_balance_cents,
  });
}
