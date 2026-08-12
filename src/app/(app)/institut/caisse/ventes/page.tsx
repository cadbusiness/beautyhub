import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { formatPrice } from "@/lib/utils";

const DOC_TYPES = ["ticket", "invoice", "delivery_note", "credit_note"] as const;

export default async function CaisseVentesPage() {
  const t = await getTranslations("pos.sales");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("inst_sale_documents")
    .select(
      `
      id,
      doc_type,
      doc_number,
      sale_group_number,
      status,
      issued_at,
      sale_id,
      credit_note_id,
      inst_sales (
        total_cents,
        currency,
        clients ( full_name, email )
      ),
      inst_credit_notes (
        amount_cents,
        client_id
      )
    `,
    )
    .eq("tenant_id", session.tenant.id)
    .order("issued_at", { ascending: false })
    .limit(150);

  return (
    <DataTable empty={(documents ?? []).length === 0 ? t("empty") : undefined}>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200">
          <tr>
            <th className={dataTableHead}>{t("columns.reference")}</th>
            <th className={dataTableHead}>{t("columns.type")}</th>
            <th className={dataTableHead}>{t("columns.status")}</th>
            <th className={dataTableHead}>{t("columns.client")}</th>
            <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.amount")}</th>
            <th className={dataTableHead}>{t("columns.date")}</th>
            <th className={`w-24 ${dataTableHead}`}>{t("columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {(documents ?? []).map((doc) => {
            const sale = doc.inst_sales as {
              total_cents: number;
              currency: string;
              clients: { full_name: string | null; email: string } | null;
            } | null;
            const credit = doc.inst_credit_notes as {
              amount_cents: number;
              client_id: string | null;
            } | null;
            const client = sale?.clients ?? null;
            const amountCents =
              doc.doc_type === "credit_note"
                ? -(credit?.amount_cents ?? 0)
                : (sale?.total_cents ?? 0);
            const currency = sale?.currency ?? "eur";
            const date = format.dateTime(new Date(doc.issued_at), {
              dateStyle: "medium",
              timeStyle: doc.doc_type === "ticket" ? "short" : undefined,
            });
            const groupSuffix = doc.sale_group_number ? ` / ${doc.sale_group_number}` : "";

            return (
              <tr key={doc.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                  {doc.doc_number}
                  {groupSuffix}
                </td>
                <td className={dataTableCell}>
                  {DOC_TYPES.includes(doc.doc_type as (typeof DOC_TYPES)[number])
                    ? t(`types.${doc.doc_type as (typeof DOC_TYPES)[number]}`)
                    : doc.doc_type}
                </td>
                <td className={dataTableCell}>
                  {t(`status.${doc.status as "issued"}`, { defaultValue: doc.status })}
                </td>
                <td className={dataTableCell}>
                  {client ? client.full_name ?? client.email : tCommon("dash")}
                </td>
                <td className={`text-right tabular-nums font-medium ${dataTableCell}`}>
                  {formatPrice(amountCents, currency)}
                </td>
                <td className={`whitespace-nowrap text-slate-600 ${dataTableCell}`}>{date}</td>
                <td className={dataTableCell}>
                  <Link
                    href={`/institut/caisse/documents/${doc.id}`}
                    className="text-slate-900 underline"
                  >
                    {t("open")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTable>
  );
}
