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

/**
 * GET /api/mobile/institut/sales
 * Historique des ventes de caisse pour l'app mobile.
 * ?limit=40&cursor=<created_at ISO>&status=paid|partial|refunded
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
         inst_sale_items ( name, quantity, unit_price_cents ),
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
    const items = (hasMore ? rows.slice(0, limit) : rows).map((sale) => {
      const client = sale.clients as
        | { full_name: string | null; email: string }
        | null;
      const items = (sale.inst_sale_items ?? []) as Array<{
        name: string;
        quantity: number;
        unit_price_cents: number;
      }>;
      const payments = (sale.inst_sale_payments ?? []) as Array<{
        method: string;
        amount_cents: number;
      }>;
      const clientEmail = client && !isPlaceholderEmail(client.email)
        ? client.email
        : null;
      const clientLabel = client
        ? client.full_name ?? clientEmail ?? "Cliente"
        : null;

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
        itemsCount: items.reduce((sum, i) => sum + (i.quantity ?? 0), 0),
        itemsSummary: items
          .slice(0, 4)
          .map((i) => `${i.quantity}× ${i.name}`)
          .join(", "),
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPriceCents: i.unit_price_cents,
        })),
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
