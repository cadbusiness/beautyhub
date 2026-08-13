import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { issueGiftCardsForWooOrder } from "@/lib/institut/woo-gift-cards";
import type { WooOrderWebhookPayload } from "@/lib/institut/woo-order-sales";
import { redeemVoucher } from "@/lib/institut/vouchers-core";
import {
  applyWooStockUpdate,
  deactivateWooProduct,
  resolveWooWebhookConnection,
  upsertWooProduct,
  verifyWebhookSignature,
} from "@/lib/woocommerce";
import type { WooProduct } from "@/lib/woocommerce/client";

interface WebhookBody {
  event: string;
  payload: Record<string, unknown>;
}

function asWooProduct(payload: Record<string, unknown>): WooProduct | null {
  const id = payload.id;
  const name = payload.name;
  const price = payload.price;
  if (typeof id !== "number" || typeof name !== "string") return null;
  return {
    id,
    name,
    sku: typeof payload.sku === "string" ? payload.sku : "",
    price: typeof price === "string" ? price : "0",
    stock_quantity:
      typeof payload.stock_quantity === "number"
        ? payload.stock_quantity
        : payload.stock_quantity === null
          ? null
          : null,
    status: typeof payload.status === "string" ? payload.status : "publish",
    images: Array.isArray(payload.images)
      ? payload.images.filter(
          (img): img is { src: string } =>
            typeof img === "object" &&
            img !== null &&
            typeof (img as { src?: unknown }).src === "string",
        )
      : undefined,
    categories: Array.isArray(payload.categories)
      ? payload.categories
          .map((cat) => {
            if (typeof cat === "string") {
              return { id: 0, name: cat, slug: cat.toLowerCase().replace(/\s+/g, "-") };
            }
            if (
              typeof cat === "object" &&
              cat !== null &&
              typeof (cat as { name?: unknown }).name === "string"
            ) {
              return {
                id:
                  typeof (cat as { id?: unknown }).id === "number"
                    ? (cat as { id: number }).id
                    : 0,
                name: (cat as { name: string }).name,
                slug:
                  typeof (cat as { slug?: unknown }).slug === "string"
                    ? (cat as { slug: string }).slug
                    : (cat as { name: string }).name.toLowerCase().replace(/\s+/g, "-"),
              };
            }
            return null;
          })
          .filter(
            (cat): cat is { id: number; name: string; slug: string } =>
              cat !== null && cat.name.trim().length > 0,
          )
      : undefined,
    meta_data: Array.isArray(payload.meta_data)
      ? payload.meta_data
          .filter(
            (m): m is { key: string; value: unknown } =>
              typeof m === "object" &&
              m !== null &&
              typeof (m as { key?: unknown }).key === "string",
          )
          .map((m) => ({ key: m.key, value: (m as { value?: unknown }).value }))
      : undefined,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const connection = await resolveWooWebhookConnection(token);
  if (!connection) {
    return NextResponse.json({ error: "unknown_token" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-beautyhub-signature");
  if (!verifyWebhookSignature(rawBody, signature, connection.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { event, payload } = body;

  try {
    switch (event) {
      case "product.created":
      case "product.updated": {
        const product = asWooProduct(payload);
        if (!product) {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        await upsertWooProduct(
          supabase,
          connection.tenantId,
          connection.connectionId,
          product,
        );
        break;
      }
      case "product.stock_updated": {
        const wooId = payload.id;
        if (typeof wooId !== "number") {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        const stock =
          typeof payload.stock_quantity === "number"
            ? payload.stock_quantity
            : payload.stock_quantity === null
              ? null
              : null;
        await applyWooStockUpdate(
          supabase,
          connection.tenantId,
          connection.connectionId,
          wooId,
          stock,
        );
        break;
      }
      case "product.deleted": {
        const wooId = payload.id;
        if (typeof wooId !== "number") {
          return NextResponse.json({ error: "invalid_product" }, { status: 400 });
        }
        await deactivateWooProduct(
          supabase,
          connection.tenantId,
          connection.connectionId,
          wooId,
        );
        break;
      }
      case "order.completed": {
        if (typeof payload.id !== "number") {
          return NextResponse.json({ error: "invalid_order" }, { status: 400 });
        }

        if (Array.isArray(payload.coupon_lines)) {
          for (const line of payload.coupon_lines) {
            if (
              typeof line === "object" &&
              line !== null &&
              typeof (line as { code?: unknown }).code === "string"
            ) {
              const code = String((line as { code: string }).code).trim().toUpperCase();
              if (!code || !/^(VC|GC|AV|BHV)[A-Z0-9-]*$/.test(code)) continue;
              const discount =
                typeof (line as { discount?: unknown }).discount === "number"
                  ? (line as { discount: number }).discount
                  : Number.parseFloat(String((line as { discount?: unknown }).discount ?? "0"));
              const amountCents = Math.max(1, Math.round(discount * 100));
              await redeemVoucher(supabase, connection.tenantId, {
                code,
                amountCents,
                sourceChannel: "woo",
                wooOrderId: payload.id,
                wooCouponCode: code,
                idempotencyKey: `woo:webhook:${payload.id}:${code}:${amountCents}`,
                metadata: {
                  event: event,
                },
              });
            }
          }
        }

        const billing =
          typeof payload.billing === "object" && payload.billing !== null
            ? (payload.billing as Record<string, unknown>)
            : null;
        const recipientName = [billing?.first_name, billing?.last_name]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
          .join(" ");

        await issueGiftCardsForWooOrder(
          supabase,
          connection.tenantId,
          payload.id,
          Array.isArray(payload.line_items)
            ? (payload.line_items as Array<Record<string, unknown>>)
            : [],
          {
            recipientName: recipientName || null,
            currency: typeof payload.currency === "string" ? payload.currency : null,
          },
        );

        const { ingestWooCompletedOrder } = await import("@/lib/institut/woo-order-sales");
        await ingestWooCompletedOrder(
          supabase,
          connection.tenantId,
          connection.connectionId,
          {
            id: payload.id,
            total: payload.total as number | string | undefined,
            currency: typeof payload.currency === "string" ? payload.currency : undefined,
            date_completed:
              typeof payload.date_completed === "string" ? payload.date_completed : null,
            customer_id:
              typeof payload.customer_id === "number" ? payload.customer_id : undefined,
            billing:
              typeof payload.billing === "object" && payload.billing !== null
                ? (payload.billing as WooOrderWebhookPayload["billing"])
                : undefined,
            line_items: Array.isArray(payload.line_items)
              ? (payload.line_items as WooOrderWebhookPayload["line_items"])
              : undefined,
            meta:
              typeof payload.meta === "object" && payload.meta !== null
                ? (payload.meta as WooOrderWebhookPayload["meta"])
                : undefined,
          },
        );
        break;
      }
      case "customer.created":
      case "customer.updated": {
        const wooCustomerId = payload.id;
        if (typeof wooCustomerId !== "number" || wooCustomerId <= 0) {
          return NextResponse.json({ error: "invalid_customer" }, { status: 400 });
        }
        const billing =
          typeof payload.billing === "object" && payload.billing !== null
            ? (payload.billing as Record<string, unknown>)
            : {};
        const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const email = str(payload.email) || str(billing.email);
        const phone = str(billing.phone);
        const username = str(payload.username);

        // Applique le même fallback (username / préfixe email) que le bulk import
        // pour ne jamais créer une fiche BH avec full_name = null quand Woo a des
        // informations exploitables.
        const { deriveWooCustomerNames } = await import(
          "@/lib/woocommerce/customer-names"
        );
        const { firstName, lastName } = deriveWooCustomerNames({
          first_name: str(payload.first_name),
          last_name: str(payload.last_name),
          billing: {
            first_name: str(billing.first_name),
            last_name: str(billing.last_name),
            email: str(billing.email),
          },
          username: username || null,
          email: email || null,
        });

        // On ne dédup pas si on a strictement aucun identifiant discriminant.
        if (!email && !phone && !firstName && !lastName) {
          break;
        }

        const { findOrCreateClientFromExternal } = await import(
          "@/lib/institut/clients-dedup"
        );
        await findOrCreateClientFromExternal(supabase, {
          tenantId: connection.tenantId,
          source: "woo",
          externalId: String(wooCustomerId),
          email: email || null,
          phone: phone || null,
          firstName,
          lastName,
          extraTags: ["WooCommerce"],
          metadata: {
            woo_customer_id: wooCustomerId,
            woo_username: username || null,
            woo_date_created:
              typeof payload.date_created === "string" ? payload.date_created : null,
            woo_billing: {
              city: str(billing.city) || null,
              postcode: str(billing.postcode) || null,
              country: str(billing.country) || null,
            },
          },
          softMerge: true,
        });
        break;
      }
      case "customer.deleted": {
        const wooCustomerId = payload.id;
        if (typeof wooCustomerId !== "number" || wooCustomerId <= 0) {
          return NextResponse.json({ error: "invalid_customer" }, { status: 400 });
        }
        // On ne supprime jamais : on marque la fiche comme "supprimée côté Woo"
        // pour audit + retirer le badge WooCommerce.
        const { data: existing } = await supabase
          .from("clients")
          .select("id, tags, metadata")
          .eq("tenant_id", connection.tenantId)
          .eq("source", "woo")
          .eq("external_id", String(wooCustomerId))
          .maybeSingle();
        if (existing) {
          const filteredTags = ((existing.tags as string[] | null) ?? []).filter(
            (t) => t !== "WooCommerce",
          );
          await supabase
            .from("clients")
            .update({
              tags: filteredTags,
              metadata: {
                ...((existing.metadata as Record<string, unknown> | null) ?? {}),
                woo_deleted_at: new Date().toISOString(),
              } as never,
            })
            .eq("id", existing.id);
        }
        break;
      }
      default:
        return NextResponse.json({ error: "unknown_event" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
