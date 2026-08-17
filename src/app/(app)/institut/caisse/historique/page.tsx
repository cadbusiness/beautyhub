import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { historyPeriodBoundsUtc, parseHistoryPeriod } from "@/lib/date";
import { creditedCentsBySaleIds } from "@/lib/institut/pos-vouchers";
import { HistoryFilterBar } from "../history-filter-bar";
import {
  SalesHistoryAccordion,
  type HistorySale,
} from "./sales-history-accordion";

type SaleDoc = { id: string; doc_type: string; doc_number: string };

function parseDocFilter(value: string | undefined): "all" | "invoice" {
  return value === "invoice" ? "invoice" : "all";
}

export default async function CaisseHistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; type?: string; q?: string }>;
}) {
  const t = await getTranslations("pos.history");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const params = await searchParams;
  const period = parseHistoryPeriod(params.period);
  const status = params.status === "partial" || params.status === "paid" ? params.status : "all";
  const type = parseDocFilter(params.type);
  const q = (params.q ?? "").trim().toLowerCase();
  const bounds = historyPeriodBoundsUtc(period);

  let query = supabase
    .from("inst_sales")
    .select(
      `
 id,
 ticket_number,
 total_cents,
 amount_paid_cents,
 payment_method,
 status,
 notes,
 created_at,
 currency,
 clients ( full_name, email ),
 inst_sale_items ( name, quantity, line_total_cents ),
 inst_sale_payments ( method, amount_cents ),
 inst_sale_documents ( id, doc_type, doc_number )
 `,
    )
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false })
    .limit(150);

  if (bounds) {
    query = query
      .gte("created_at", bounds.start.toISOString())
      .lt("created_at", bounds.endExclusive.toISOString());
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: sales } = await query;
  const filtered = (sales ?? []).filter((sale) => {
    const documents = (sale.inst_sale_documents ?? []) as SaleDoc[];
    if (type === "invoice" && !documents.some((d) => d.doc_type === "invoice")) {
      return false;
    }
    if (!q) return true;
    const client = sale.clients as { full_name: string | null; email: string } | null;
    const items = (sale.inst_sale_items ?? []) as Array<{ name: string }>;
    const hay = [
      sale.ticket_number ?? "",
      client?.full_name ?? "",
      client?.email ?? "",
      ...items.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const creditedMap = await creditedCentsBySaleIds(
    supabase,
    session.tenant.id,
    filtered.map((sale) => sale.id),
  );

  const rows: HistorySale[] = filtered.map((sale) => {
    const client = sale.clients as { full_name: string | null; email: string } | null;
    const items = (sale.inst_sale_items ?? []) as Array<{
      name: string;
      quantity: number;
      line_total_cents: number;
    }>;
    const payments = (sale.inst_sale_payments ?? []) as Array<{
      method: string;
      amount_cents: number;
    }>;
    const documents = (sale.inst_sale_documents ?? []) as SaleDoc[];
    return {
      id: sale.id,
      ticketNumber: sale.ticket_number,
      createdAtLabel: format.dateTime(new Date(sale.created_at), {
        dateStyle: period === "today" ? undefined : "medium",
        timeStyle: "short",
      }),
      totalCents: sale.total_cents,
      amountPaidCents: sale.amount_paid_cents,
      creditedCents: creditedMap.get(sale.id) ?? 0,
      currency: sale.currency,
      status: sale.status,
      paymentMethod: sale.payment_method,
      clientLabel: client ? client.full_name ?? client.email : null,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        lineTotalCents: item.line_total_cents,
      })),
      payments: payments.map((payment) => ({
        method: payment.method,
        amountCents: payment.amount_cents,
      })),
      documents: documents.map((doc) => ({
        id: doc.id,
        docType: doc.doc_type,
        docNumber: doc.doc_number,
      })),
    };
  });

  const emptyMessage =
    rows.length === 0
      ? type === "invoice"
        ? t("emptyInvoice")
        : q || status !== "all"
          ? t("emptyFiltered")
          : period === "today"
            ? t("emptyToday")
            : t("empty")
      : undefined;

  return (
    <>
      <HistoryFilterBar
        pathname="/institut/caisse/historique"
        period={period}
        status={status}
        type={type}
        q={params.q ?? ""}
        searchPlaceholder={t("searchPlaceholder")}
        statusLabel={t("filters.statusLabel")}
        typeLabel={t("filters.typeLabel")}
        periodOptions={[
          { value: "today", label: t("filters.today") },
          { value: "yesterday", label: t("filters.yesterday") },
          { value: "week", label: t("filters.week") },
          { value: "all", label: t("filters.all") },
        ]}
        statusOptions={[
          { value: "all", label: t("filters.statusAll") },
          { value: "paid", label: t("status.paid") },
          { value: "partial", label: t("status.partial") },
        ]}
        typeOptions={[
          { value: "all", label: t("filters.salesAll") },
          { value: "invoice", label: t("filters.invoices") },
        ]}
      />

      {emptyMessage ? (
        <p className="px-4 py-12 text-sm text-slate-500 lg:px-6">{emptyMessage}</p>
      ) : (
        <SalesHistoryAccordion sales={rows} />
      )}
      <ListPanelFooter>
        {type === "invoice"
          ? t("footerInvoices", { count: rows.length })
          : t("footer", { count: rows.length })}
      </ListPanelFooter>
    </>
  );
}
