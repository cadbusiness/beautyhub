import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { formatPrice } from "@/lib/utils";
import { historyPeriodBoundsUtc, parseHistoryPeriod } from "@/lib/date";
import { HistoryFilterBar } from "../history-filter-bar";

type SaleDoc = { id: string; doc_type: string; doc_number: string };

export default async function CaisseHistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; q?: string }>;
}) {
  const t = await getTranslations("pos.history");
  const tDocs = await getTranslations("pos.sales");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const params = await searchParams;
  const period = parseHistoryPeriod(params.period);
  const status = params.status === "partial" || params.status === "paid" ? params.status : "all";
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
 inst_sale_items ( name, quantity ),
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

  const emptyMessage =
    filtered.length === 0
      ? q || status !== "all"
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
        q={params.q ?? ""}
        searchPlaceholder={t("searchPlaceholder")}
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
      />

      <DataTable empty={emptyMessage}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHeadCompact}>{t("columns.date")}</th>
              <th className={dataTableHeadCompact}>{t("columns.ticket")}</th>
              <th className={dataTableHeadCompact}>{t("columns.client")}</th>
              <th className={`hidden sm:table-cell ${dataTableHeadCompact}`}>
                {t("columns.items")}
              </th>
              <th className={`w-24 ${dataTableHeadCompact}`}>{t("columns.status")}</th>
              <th className={`w-28 text-right ${dataTableHeadCompact}`}>{t("columns.total")}</th>
              <th className={`w-36 ${dataTableHeadCompact}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sale) => {
              const client = sale.clients as {
                full_name: string | null;
                email: string;
              } | null;
              const items = (sale.inst_sale_items ?? []) as Array<{
                name: string;
                quantity: number;
              }>;
              const payments = (sale.inst_sale_payments ?? []) as Array<{
                method: string;
                amount_cents: number;
              }>;
              const documents = (sale.inst_sale_documents ?? []) as SaleDoc[];
              const extraDocs = documents.filter((d) => d.doc_type !== "ticket");
              const date = format.dateTime(new Date(sale.created_at), {
                dateStyle: period === "today" ? undefined : "medium",
                timeStyle: "short",
              });
              const paymentSummary =
                payments.length > 1
                  ? t("mixedPayments", { count: payments.length })
                  : payments.length === 1
                    ? t(`paymentMethods.${payments[0].method as "cash"}`, {
                        defaultValue: payments[0].method,
                      })
                    : t(`paymentMethods.${sale.payment_method as "cash"}`, {
                        defaultValue: sale.payment_method,
                      });
              const itemsSummary = items
                .map((item) => `${item.quantity}× ${item.name}`)
                .join(", ");
              const statusKey = sale.status as "paid" | "partial";

              return (
                <tr key={sale.id} className={dataTableRow}>
                  <td className={`whitespace-nowrap text-slate-900 ${dataTableCellCompact}`}>
                    {date}
                  </td>
                  <td className={dataTableCellCompact}>
                    <Link
                      href={`/institut/caisse/ticket/${sale.id}`}
                      className="font-medium text-slate-900 underline"
                    >
                      {sale.ticket_number ?? t("viewTicket")}
                    </Link>
                    <p className="text-xs text-slate-500">{paymentSummary}</p>
                  </td>
                  <td className={dataTableCellCompact}>
                    {client ? (
                      <p className="truncate text-slate-900">
                        {client.full_name ?? client.email}
                      </p>
                    ) : (
                      <span className="text-slate-400">{tCommon("dash")}</span>
                    )}
                  </td>
                  <td className={`hidden max-w-0 sm:table-cell ${dataTableCellCompact}`}>
                    <p className="truncate text-slate-600" title={itemsSummary}>
                      {itemsSummary || tCommon("dash")}
                    </p>
                  </td>
                  <td className={dataTableCellCompact}>
                    <span
                      className={
                        statusKey === "partial" ? "text-amber-600" : "text-slate-600"
                      }
                    >
                      {t(`status.${statusKey}`, { defaultValue: sale.status })}
                    </span>
                    {sale.status === "partial" ? (
                      <p className="text-xs text-amber-600">
                        {formatPrice(sale.amount_paid_cents, sale.currency)} {t("paidShort")}
                      </p>
                    ) : null}
                  </td>
                  <td
                    className={`whitespace-nowrap text-right font-medium tabular-nums text-slate-900 ${dataTableCellCompact}`}
                  >
                    {formatPrice(sale.total_cents, sale.currency)}
                  </td>
                  <td className={dataTableCellCompact}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <Link
                        href={`/institut/caisse/ticket/${sale.id}`}
                        className="text-slate-700 underline"
                      >
                        {t("viewTicket")}
                      </Link>
                      {extraDocs.map((doc) => (
                        <Link
                          key={doc.id}
                          href={`/institut/caisse/documents/${doc.id}`}
                          className="text-slate-700 underline"
                          title={doc.doc_number}
                        >
                          {tDocs(`types.${doc.doc_type as "invoice"}`, {
                            defaultValue: doc.doc_type,
                          })}
                        </Link>
                      ))}
                      {sale.status === "partial" ? (
                        <Link
                          href={`/institut/caisse/solde/${sale.id}`}
                          className="font-medium text-amber-700 underline"
                        >
                          {t("payBalance")}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
      <ListPanelFooter>
        {t("footer", { count: filtered.length })}
      </ListPanelFooter>
    </>
  );
}
