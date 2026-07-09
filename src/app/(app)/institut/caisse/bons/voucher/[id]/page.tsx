import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { PrintVoucherButton } from "./print-button";

export default async function VoucherDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("pos.vouchers");
  const tTicket = await getTranslations("pos.ticket");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();

  const [{ data: voucher }, { data: events }] = await Promise.all([
    supabase
      .from("inst_vouchers")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inst_voucher_events")
      .select("id, event_type, amount_cents, balance_after_cents, source_channel, created_at")
      .eq("tenant_id", session.tenant.id)
      .eq("voucher_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!voucher) notFound();

  return (
    <div className="mx-auto max-w-xl bg-white p-8 print:p-4">
      <div className="mb-6 flex items-start justify-between border-b border-dashed border-slate-300 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("vouchersTitle")}</p>
          <h1 className="font-mono text-xl font-semibold text-slate-900">{voucher.code}</h1>
          <p className="text-sm text-slate-500">
            {t(`types.${voucher.voucher_type as "voucher"}`)} · {t(`status.${voucher.status as "active"}`)}
          </p>
        </div>
        <PrintVoucherButton label={tTicket("print")} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("columns.balance")}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatPrice(voucher.current_balance_cents)}
          </p>
          <p className="text-xs text-slate-500">
            / {formatPrice(voucher.initial_amount_cents)}
          </p>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("columns.date")}</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {format.dateTime(new Date(voucher.created_at), {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
          {voucher.expires_at ? (
            <p className="mt-1 text-xs text-slate-500">
              Exp:{" "}
              {format.dateTime(new Date(voucher.expires_at), {
                dateStyle: "short",
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("columns.lastEvent")}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">{t("columns.date")}</th>
              <th className="py-2">{t("columns.type")}</th>
              <th className="py-2 text-right">{t("columns.balance")}</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((event) => (
              <tr key={event.id} className="border-b border-slate-100">
                <td className="py-2 text-xs text-slate-500">
                  {format.dateTime(new Date(event.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="py-2 text-slate-800">{t(`events.${event.event_type as "issue"}`)}</td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {formatPrice(event.balance_after_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
