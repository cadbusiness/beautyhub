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

const DOC_TYPES = ["ticket", "invoice", "delivery_note", "credit_note"] as const;
type DocType = (typeof DOC_TYPES)[number];

function parseDocType(value: string | undefined): DocType | "all" {
  return DOC_TYPES.includes(value as DocType) ? (value as DocType) : "all";
}

export default async function CaisseVentesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; type?: string; status?: string; q?: string }>;
}) {
  const t = await getTranslations("pos.sales");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const params = await searchParams;
  const period = parseHistoryPeriod(params.period);
  const type = parseDocType(params.type);
  const status = params.status && params.status !== "all" ? params.status : "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const bounds = historyPeriodBoundsUtc(period);

  let query = supabase
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

  if (bounds) {
    query = query
      .gte("issued_at", bounds.start.toISOString())
      .lt("issued_at", bounds.endExclusive.toISOString());
  }
  if (type !== "all") {
    query = query.eq("doc_type", type);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: documents } = await query;
  const filtered = (documents ?? []).filter((doc) => {
    if (!q) return true;
    const sale = doc.inst_sales as {
      clients: { full_name: string | null; email: string } | null;
    } | null;
    const hay = [
      doc.doc_number,
      doc.sale_group_number ?? "",
      sale?.clients?.full_name ?? "",
      sale?.clients?.email ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const emptyMessage =
    filtered.length === 0
      ? type === "invoice"
        ? t("emptyInvoice")
        : q || type !== "all" || status !== "all"
        ? t("emptyFiltered")
        : period === "today"
          ? t("emptyToday")
          : t("empty")
      : undefined;

  return (
    <>
      <HistoryFilterBar
        pathname="/institut/caisse/ventes"
        period={period}
        type={type}
        q={params.q ?? ""}
        searchPlaceholder={t("searchPlaceholder")}
        typeLabel={t("filters.typeLabel")}
        periodOptions={[
          { value: "today", label: t("filters.today") },
          { value: "yesterday", label: t("filters.yesterday") },
          { value: "week", label: t("filters.week") },
          { value: "all", label: t("filters.all") },
        ]}
        typeOptions={[
          { value: "all", label: t("filters.typeAll") },
          { value: "ticket", label: t("types.ticket") },
          { value: "invoice", label: t("types.invoice") },
          { value: "delivery_note", label: t("types.delivery_note") },
          { value: "credit_note", label: t("types.credit_note") },
        ]}
      />

      <DataTable empty={emptyMessage}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHeadCompact}>{t("columns.reference")}</th>
              <th className={dataTableHeadCompact}>{t("columns.type")}</th>
              <th className={dataTableHeadCompact}>{t("columns.status")}</th>
              <th className={dataTableHeadCompact}>{t("columns.client")}</th>
              <th className={`w-28 text-right ${dataTableHeadCompact}`}>
                {t("columns.amount")}
              </th>
              <th className={dataTableHeadCompact}>{t("columns.date")}</th>
              <th className={`w-20 ${dataTableHeadCompact}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc) => {
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
                dateStyle: period === "today" ? undefined : "medium",
                timeStyle: doc.doc_type === "ticket" || period === "today" ? "short" : undefined,
              });
              const groupSuffix = doc.sale_group_number ? ` / ${doc.sale_group_number}` : "";

              return (
                <tr key={doc.id} className={dataTableRow}>
                  <td className={`font-medium text-slate-900 ${dataTableCellCompact}`}>
                    {doc.doc_number}
                    {groupSuffix}
                  </td>
                  <td className={dataTableCellCompact}>
                    {DOC_TYPES.includes(doc.doc_type as DocType)
                      ? t(`types.${doc.doc_type as DocType}`)
                      : doc.doc_type}
                  </td>
                  <td className={dataTableCellCompact}>
                    {t(`status.${doc.status as "issued"}`, { defaultValue: doc.status })}
                  </td>
                  <td className={dataTableCellCompact}>
                    {client ? client.full_name ?? client.email : tCommon("dash")}
                  </td>
                  <td className={`text-right tabular-nums font-medium ${dataTableCellCompact}`}>
                    {formatPrice(amountCents, currency)}
                  </td>
                  <td className={`whitespace-nowrap text-slate-600 ${dataTableCellCompact}`}>
                    {date}
                  </td>
                  <td className={dataTableCellCompact}>
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
      <ListPanelFooter>{t("footer", { count: filtered.length })}</ListPanelFooter>
    </>
  );
}
