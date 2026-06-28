import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { GiftCardForm } from "./gift-card-form";
import { CreditNoteForm } from "./credit-note-form";

export default async function CaisseBonsPage() {
  const t = await getTranslations("pos.vouchers");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [giftCards, creditNotes, partialSales] = await Promise.all([
    supabase
      .from("inst_gift_cards")
      .select("id, code, balance_cents, initial_balance_cents, status, recipient_name, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inst_credit_notes")
      .select("id, credit_number, remaining_cents, amount_cents, status, reason, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inst_sales")
      .select("id, ticket_number, total_cents, amount_paid_cents, status, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["paid", "partial"])
      .gt("amount_paid_cents", 0)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">{t("issueGiftCard")}</h2>
          <GiftCardForm />
        </Card>
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">{t("issueCreditNote")}</h2>
          <CreditNoteForm
            sales={(partialSales.data ?? []).concat([])}
          />
        </Card>
      </div>

      <DataTable empty={(giftCards.data ?? []).length === 0 ? t("noGiftCards") : undefined}>
        <h3 className="mb-3 text-sm font-medium text-slate-900">{t("giftCardsTitle")}</h3>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.code")}</th>
              <th className={dataTableHead}>{t("columns.balance")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={dataTableHead}>{t("columns.date")}</th>
            </tr>
          </thead>
          <tbody>
            {(giftCards.data ?? []).map((g) => (
              <tr key={g.id} className={dataTableRow}>
                <td className={`font-mono text-slate-900 ${dataTableCell}`}>{g.code}</td>
                <td className={`tabular-nums ${dataTableCell}`}>
                  {formatPrice(g.balance_cents)} / {formatPrice(g.initial_balance_cents)}
                </td>
                <td className={dataTableCell}>{t(`status.${g.status as "active"}`)}</td>
                <td className={`whitespace-nowrap ${dataTableCell}`}>
                  {format.dateTime(new Date(g.created_at), { dateStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      <DataTable empty={(creditNotes.data ?? []).length === 0 ? t("noCreditNotes") : undefined}>
        <h3 className="mb-3 text-sm font-medium text-slate-900">{t("creditNotesTitle")}</h3>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.number")}</th>
              <th className={dataTableHead}>{t("columns.remaining")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={dataTableHead}>{t("columns.date")}</th>
            </tr>
          </thead>
          <tbody>
            {(creditNotes.data ?? []).map((n) => (
              <tr key={n.id} className={dataTableRow}>
                <td className={`font-mono text-slate-900 ${dataTableCell}`}>{n.credit_number}</td>
                <td className={`tabular-nums ${dataTableCell}`}>
                  {formatPrice(n.remaining_cents)} / {formatPrice(n.amount_cents)}
                </td>
                <td className={dataTableCell}>{t(`status.${n.status as "active"}`)}</td>
                <td className={`whitespace-nowrap ${dataTableCell}`}>
                  {format.dateTime(new Date(n.created_at), { dateStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
    </div>
  );
}
