import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { formatPrice } from "@/lib/utils";

export default async function CaisseHistoriquePage() {
  const t = await getTranslations("pos.history");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: sales } = await supabase
    .from("inst_sales")
    .select(
      `
 id,
 ticket_number,
 total_cents,
 amount_paid_cents,
 vat_cents,
 discount_cents,
 payment_method,
 status,
 woo_order_id,
 notes,
 created_at,
 clients ( full_name, email ),
 inst_sale_items ( name, quantity, unit_price_cents, item_type ),
 inst_sale_payments ( method, amount_cents )
 `,
    )
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <DataTable empty={(sales ?? []).length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.date")}</th>
              <th className={dataTableHead}>{t("columns.ticket")}</th>
              <th className={dataTableHead}>{t("columns.client")}</th>
              <th className={dataTableHead}>{t("columns.items")}</th>
              <th className={`w-24 ${dataTableHead}`}>{t("columns.status")}</th>
              <th className={`w-28 ${dataTableHead}`}>{t("columns.payment")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.total")}</th>
            </tr>
          </thead>
          <tbody>
            {(sales ?? []).map((sale) => {
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
              const date = format.dateTime(new Date(sale.created_at), {
                dateStyle: "medium",
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
                  <td className={`whitespace-nowrap text-slate-900 ${dataTableCell}`}>
                    {date}
                  </td>
                  <td className={dataTableCell}>
                    {sale.ticket_number ? (
                      <Link
                        href={`/institut/caisse/ticket/${sale.id}`}
                        className="font-medium text-slate-900 underline"
                      >
                        {sale.ticket_number}
                      </Link>
                    ) : (
                      <Link
                        href={`/institut/caisse/ticket/${sale.id}`}
                        className="text-slate-500 underline"
                      >
                        {t("viewTicket")}
                      </Link>
                    )}
                  </td>
                  <td className={dataTableCell}>
                    {client ? (
                      <>
                        <p className="text-slate-900">{client.full_name ?? client.email}</p>
                        {client.full_name ? (
                          <p className="text-xs text-slate-500">{client.email}</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">{tCommon("dash")}</span>
                    )}
                  </td>
                  <td className={`max-w-0 ${dataTableCell}`}>
                    <p className="truncate text-slate-600" title={itemsSummary}>
                      {itemsSummary || tCommon("dash")}
                    </p>
                    {sale.notes ? (
                      <p className="truncate text-xs italic text-slate-400">{sale.notes}</p>
                    ) : null}
                  </td>
                  <td className={dataTableCell}>
                    <span
                      className={
                        statusKey === "partial"
                          ? "text-amber-600"
                          : "text-slate-600"
                      }
                    >
                      {t(`status.${statusKey}`, { defaultValue: sale.status })}
                    </span>
                    {sale.status === "partial" ? (
                      <Link
                        href={`/institut/caisse/solde/${sale.id}`}
                        className="ml-2 text-xs underline"
                      >
                        {t("payBalance")}
                      </Link>
                    ) : null}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>{paymentSummary}</td>
                  <td
                    className={`whitespace-nowrap text-right font-medium tabular-nums text-slate-900 ${dataTableCell}`}
                  >
                    {formatPrice(sale.total_cents)}
                    {sale.status === "partial" ? (
                      <p className="text-xs font-normal text-amber-600">
                        {formatPrice(sale.amount_paid_cents)} {t("paidShort")}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
    </>
  );
}
