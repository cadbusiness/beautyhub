import {
  mobileErrorResponse,
  requireMobileTenantSession,
} from "@/lib/mobile/session";
import {
  addCalendarDays,
  calendarDateString,
  historyPeriodBoundsUtc,
  isYmd,
  parseHistoryPeriod,
  todayDateString,
  zonedDayStartUtc,
} from "@/lib/date";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const DOC_TYPES = ["ticket", "invoice", "delivery_note", "credit_note"] as const;

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
 * GET /api/mobile/institut/documents
 * Historique des documents de vente (tickets, factures, BL, avoirs).
 * ?limit=40&cursor=<issued_at ISO>&docType=&from=YYYY-MM-DD&to=YYYY-MM-DD
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
    const docType = url.searchParams.get("docType");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const periodParam = url.searchParams.get("period");
    const periodBounds =
      periodParam && periodParam !== "all"
        ? historyPeriodBoundsUtc(parseHistoryPeriod(periodParam))
        : null;

    let query = session.supabase
      .from("inst_sale_documents")
      .select(
        `
        id, doc_type, doc_number, status, issued_at, sale_id,
        inst_sales ( total_cents, clients ( full_name, email ) ),
        inst_credit_notes ( amount_cents )
      `,
      )
      .eq("tenant_id", session.tenant.id)
      .order("issued_at", { ascending: false })
      .limit(limit + 1);

    if (docType && DOC_TYPES.includes(docType as (typeof DOC_TYPES)[number])) {
      query = query.eq("doc_type", docType);
    }
    if (periodBounds) {
      query = query
        .gte("issued_at", periodBounds.start.toISOString())
        .lt("issued_at", periodBounds.endExclusive.toISOString());
    } else {
      if (isYmd(from)) {
        query = query.gte("issued_at", zonedDayStartUtc(from).toISOString());
      }
      if (isYmd(to)) {
        query = query.lt(
          "issued_at",
          zonedDayStartUtc(addCalendarDays(to, 1)).toISOString(),
        );
      }
    }
    if (cursor) {
      query = query.lt("issued_at", cursor);
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

    const items = pageRows.map((doc) => {
      const sale = doc.inst_sales as {
        total_cents: number;
        clients: { full_name: string | null; email: string } | null;
      } | null;
      const credit = doc.inst_credit_notes as { amount_cents: number } | null;
      const client = sale?.clients ?? null;
      const clientEmail =
        client && !isPlaceholderEmail(client.email) ? client.email : null;
      const amountCents =
        doc.doc_type === "credit_note"
          ? -(credit?.amount_cents ?? 0)
          : (sale?.total_cents ?? 0);

      return {
        id: doc.id,
        docType: doc.doc_type,
        docNumber: doc.doc_number,
        status: doc.status,
        issuedAt: doc.issued_at,
        calendarDate: calendarDateString(doc.issued_at),
        saleId: doc.sale_id,
        amountCents,
        clientLabel: client ? (client.full_name ?? clientEmail ?? "Cliente") : null,
      };
    });

    const nextCursor = hasMore ? rows[limit - 1].issued_at : null;
    return Response.json({ items, nextCursor, today: todayDateString() });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
