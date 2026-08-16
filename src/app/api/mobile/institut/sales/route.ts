import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (
    email.endsWith("@beautyhub.local") ||
    email.endsWith("@no-email.local") ||
    email.endsWith("@overcache.local") ||
    email.includes("@import.")
  );
}

type SaleItemRow = {
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  line_vat_cents: number;
  discount_cents: number;
  item_type: string;
  product_id: string | null;
  service_id: string | null;
};

type SalePaymentRow = { method: string; amount_cents: number };
type ClientRow = { full_name: string | null; email: string } | null;

type ProductDetails = {
  imageUrl: string | null;
  sku: string | null;
  source: string | null;
  wooCategories: string[];
  wooId: number | null;
  stockQuantity: number | null;
  isGiftCard: boolean;
};

type ServiceDetails = {
  imageUrl: string | null;
  color: string | null;
  durationMin: number | null;
  description: string | null;
};

/**
 * GET /api/mobile/institut/sales
 * Historique des ventes de caisse pour l'app mobile.
 * ?limit=40&cursor=<created_at ISO>&status=paid|partial|refunded
 *
 * Enrichit chaque article avec les détails produit/prestation (image, sku,
 * catégorie, durée…) via requêtes séparées + join JS.
 */
export async function GET(request: Request) {
  try {
    const session = await requireMobileTenantSession(request, {
      moduleId: "institut",
    });
    const url = new URL(request.url);
    const limitRaw = Number.parseInt(
      url.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
      10,
    );
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const cursor = url.searchParams.get("cursor");
    const status = url.searchParams.get("status");

    let query = session.supabase
      .from("inst_sales")
      .select(
        `id, ticket_number, total_cents, amount_paid_cents, status, payment_method, notes, created_at,
         clients ( full_name, email ),
         inst_sale_items ( name, quantity, unit_price_cents, line_total_cents, line_vat_cents, discount_cents, item_type, product_id, service_id ),
         inst_sale_payments ( method, amount_cents )`,
      )
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;
    if (error) {
      return Response.json(
        { error: "fetch_failed", message: error.message },
        { status: 500 },
      );
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Collecte des ids produits/services à enrichir.
    const productIds = new Set<string>();
    const serviceIds = new Set<string>();
    for (const sale of pageRows) {
      const items = (sale.inst_sale_items ?? []) as SaleItemRow[];
      for (const it of items) {
        if (it.product_id) productIds.add(it.product_id);
        if (it.service_id) serviceIds.add(it.service_id);
      }
    }

    // Requêtes séparées (pas d'embed PostgREST fragile).
    const [productsRes, servicesRes] = await Promise.all([
      productIds.size > 0
        ? session.supabase
            .from("inst_products")
            .select(
              "id, image_url, sku, source, woo_categories, woo_id, stock_quantity, is_gift_card",
            )
            .eq("tenant_id", session.tenant.id)
            .in("id", Array.from(productIds))
        : Promise.resolve({ data: [], error: null }),
      serviceIds.size > 0
        ? session.supabase
            .from("inst_services")
            .select("id, image_url, color, duration_min, description")
            .eq("tenant_id", session.tenant.id)
            .in("id", Array.from(serviceIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    const productMap = new Map<string, ProductDetails>();
    for (const p of productsRes.data ?? []) {
      productMap.set(p.id, {
        imageUrl: p.image_url,
        sku: p.sku,
        source: p.source,
        wooCategories: p.woo_categories ?? [],
        wooId: p.woo_id,
        stockQuantity: p.stock_quantity,
        isGiftCard: p.is_gift_card,
      });
    }
    const serviceMap = new Map<string, ServiceDetails>();
    for (const s of servicesRes.data ?? []) {
      serviceMap.set(s.id, {
        imageUrl: s.image_url,
        color: s.color,
        durationMin: s.duration_min,
        description: s.description,
      });
    }

    const items = pageRows.map((sale) => {
      const client = sale.clients as ClientRow;
      const saleItems = (sale.inst_sale_items ?? []) as SaleItemRow[];
      const payments = (sale.inst_sale_payments ?? []) as SalePaymentRow[];
      const clientEmail =
        client && !isPlaceholderEmail(client.email) ? client.email : null;
      const clientLabel = client
        ? (client.full_name ?? clientEmail ?? "Cliente")
        : null;

      const enrichedItems = saleItems.map((i) => {
        const product = i.product_id ? productMap.get(i.product_id) : null;
        const service = i.service_id ? serviceMap.get(i.service_id) : null;
        return {
          name: i.name,
          quantity: i.quantity,
          unitPriceCents: i.unit_price_cents,
          lineTotalCents: i.line_total_cents,
          lineVatCents: i.line_vat_cents,
          discountCents: i.discount_cents,
          itemType: i.item_type,
          imageUrl: product?.imageUrl ?? service?.imageUrl ?? null,
          sku: product?.sku ?? null,
          durationMin: service?.durationMin ?? null,
          color: service?.color ?? null,
          description: service?.description ?? null,
          source: product?.source ?? null,
          wooCategories: product?.wooCategories ?? [],
          wooId: product?.wooId ?? null,
          stockQuantity: product?.stockQuantity ?? null,
          isGiftCard: product?.isGiftCard ?? false,
        };
      });

      return {
        id: sale.id,
        ticketNumber: sale.ticket_number,
        totalCents: sale.total_cents,
        amountPaidCents: sale.amount_paid_cents,
        status: sale.status,
        paymentMethod: sale.payment_method,
        notes: sale.notes,
        createdAt: sale.created_at,
        clientLabel,
        clientEmail,
        itemsCount: saleItems.reduce((sum, i) => sum + (i.quantity ?? 0), 0),
        itemsSummary: saleItems
          .slice(0, 4)
          .map((i) => `${i.quantity}× ${i.name}`)
          .join(", "),
        items: enrichedItems,
        payments: payments.map((p) => ({
          method: p.method,
          amountCents: p.amount_cents,
        })),
      };
    });
    const nextCursor = hasMore ? rows[limit - 1].created_at : null;

    return Response.json({ items, nextCursor });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
