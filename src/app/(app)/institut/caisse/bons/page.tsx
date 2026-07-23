import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { GiftCardForm } from "./gift-card-form";
import { CreditNoteForm } from "./credit-note-form";
import { VoucherForm } from "./voucher-form";
import { VoucherTemplatesManager } from "./voucher-templates-manager";
import { voidVoucherDirect } from "../../caisse-session-actions";

export default async function CaisseBonsPage() {
  const t = await getTranslations("pos.vouchers");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();
  const tenantId = session.tenant.id;

  const [giftCards, creditNotes, partialSales, vouchers, templates] = await Promise.all([
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
    supabase
      .from("inst_vouchers")
      .select(
        "id, code, voucher_type, current_balance_cents, initial_amount_cents, status, source_channel, expires_at, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("inst_voucher_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const voucherIds = (vouchers.data ?? []).map((row) => row.id);
  const voucherEvents = voucherIds.length
    ? await supabase
        .from("inst_voucher_events")
        .select("id, voucher_id, event_type, amount_cents, created_at")
        .eq("tenant_id", tenantId)
        .in("voucher_id", voucherIds)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] as Array<{ id: string; voucher_id: string; event_type: string; amount_cents: number; created_at: string }> };

  const latestEventByVoucher = new Map<
    string,
    { event_type: string; amount_cents: number; created_at: string }
  >();
  for (const event of voucherEvents.data ?? []) {
    if (!latestEventByVoucher.has(event.voucher_id)) {
      latestEventByVoucher.set(event.voucher_id, {
        event_type: event.event_type,
        amount_cents: event.amount_cents,
        created_at: event.created_at,
      });
    }
  }

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <VoucherTemplatesManager templates={templates.data ?? []} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">{t("issueVoucher")}</h2>
          <VoucherForm />
        </Card>
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">{t("issueGiftCard")}</h2>
          <GiftCardForm templates={templates.data ?? []} />
        </Card>
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-slate-900">{t("issueCreditNote")}</h2>
          <CreditNoteForm
            sales={(partialSales.data ?? []).concat([])}
          />
        </Card>
      </div>

      <DataTable empty={(vouchers.data ?? []).length === 0 ? t("noVouchers") : undefined}>
        <h3 className="mb-3 text-sm font-medium text-slate-900">{t("vouchersTitle")}</h3>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.code")}</th>
              <th className={dataTableHead}>{t("columns.type")}</th>
              <th className={dataTableHead}>{t("columns.balance")}</th>
              <th className={dataTableHead}>{t("columns.lastEvent")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={dataTableHead}>{t("columns.date")}</th>
              <th className={dataTableHead}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(vouchers.data ?? []).map((v) => {
              const latestEvent = latestEventByVoucher.get(v.id);
              return (
                <tr key={v.id} className={dataTableRow}>
                  <td className={`font-mono text-slate-900 ${dataTableCell}`}>{v.code}</td>
                  <td className={dataTableCell}>{t(`types.${v.voucher_type as "voucher"}`)}</td>
                  <td className={`tabular-nums ${dataTableCell}`}>
                    {formatPrice(v.current_balance_cents)} / {formatPrice(v.initial_amount_cents)}
                  </td>
                  <td className={dataTableCell}>
                    {latestEvent ? (
                      <div className="space-y-0.5">
                        <div>{t(`events.${latestEvent.event_type as "issue"}`)}</div>
                        <div className="text-xs text-slate-500">
                          {latestEvent.amount_cents > 0 ? `-${formatPrice(latestEvent.amount_cents)}` : "—"}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={dataTableCell}>{t(`status.${v.status as "active"}`)}</td>
                  <td className={`whitespace-nowrap ${dataTableCell}`}>
                    {format.dateTime(new Date(v.created_at), { dateStyle: "short" })}
                  </td>
                  <td className={dataTableCell}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/institut/caisse/bons/voucher/${v.id}`}
                        className="text-xs text-slate-600 underline"
                        target="_blank"
                      >
                        {t("openVoucher")}
                      </Link>
                      {v.status === "active" ? (
                        <form action={voidVoucherDirect}>
                          <input type="hidden" name="voucher_id" value={v.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 underline"
                          >
                            {t("voidVoucher")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>

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
