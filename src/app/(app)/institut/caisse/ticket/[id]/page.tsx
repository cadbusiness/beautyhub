import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getPosSettings, vatRateLabel } from "@/lib/institut/pos-settings";
import { formatPrice } from "@/lib/utils";
import { PrintTicketButton } from "./print-button";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("pos.ticket");
  const format = await getFormatter();
  const session = await requireModule("institut");
  const supabase = await createClient();

  const [{ data: sale }, settings] = await Promise.all([
    supabase
      .from("inst_sales")
      .select(
        `
        id,
        ticket_number,
        subtotal_cents,
        discount_cents,
        vat_cents,
        total_cents,
        amount_paid_cents,
        status,
        payment_method,
        notes,
        created_at,
        clients ( full_name, email ),
        inst_sale_items (
          name,
          quantity,
          unit_price_cents,
          vat_rate_bps,
          line_subtotal_cents,
          line_vat_cents,
          line_total_cents
        ),
        inst_sale_payments ( method, amount_cents, reference )
      `,
      )
      .eq("tenant_id", session.tenant.id)
      .eq("id", id)
      .maybeSingle(),
    getPosSettings(supabase, session.tenant.id),
  ]);

  if (!sale) notFound();

  const client = sale.clients as {
    full_name: string | null;
    email: string;
  } | null;
  const items = (sale.inst_sale_items ?? []) as Array<{
    name: string;
    quantity: number;
    unit_price_cents: number;
    vat_rate_bps: number;
    line_subtotal_cents: number;
    line_vat_cents: number;
    line_total_cents: number;
  }>;
  const payments = (sale.inst_sale_payments ?? []) as Array<{
    method: string;
    amount_cents: number;
    reference: string | null;
  }>;

  const date = format.dateTime(new Date(sale.created_at), {
    dateStyle: "long",
    timeStyle: "short",
  });

  const headerName = settings.legal_name ?? session.tenant.name;

  return (
    <div className="mx-auto max-w-md bg-white p-8 print:p-4">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{headerName}</h1>
        {settings.legal_address ? (
          <p className="whitespace-pre-line text-xs text-slate-500">
            {settings.legal_address}
          </p>
        ) : null}
        {settings.vat_number ? (
          <p className="text-xs text-slate-500">
            {t("vat")}: {settings.vat_number}
          </p>
        ) : null}
        {settings.siret ? (
          <p className="text-xs text-slate-500">SIRET: {settings.siret}</p>
        ) : null}
        {settings.ticket_header ? (
          <p className="whitespace-pre-line text-xs text-slate-500">
            {settings.ticket_header}
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex items-start justify-between border-b border-dashed border-slate-300 pb-3 text-sm">
        <div>
          <p className="font-medium text-slate-900">
            {sale.ticket_number ?? t("noNumber")}
          </p>
          <p className="text-slate-500">{date}</p>
          {client ? (
            <p className="mt-1 text-slate-600">
              {client.full_name ?? client.email}
            </p>
          ) : null}
        </div>
        <PrintTicketButton label={t("print")} />
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="pb-2">{t("item")}</th>
            <th className="pb-2 text-right">{t("qty")}</th>
            <th className="pb-2 text-right">{t("total")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                <p className="text-slate-900">{item.name}</p>
                <p className="text-[11px] text-slate-400">
                  TVA {vatRateLabel(item.vat_rate_bps)}
                </p>
              </td>
              <td className="py-2 text-right tabular-nums text-slate-600">
                {item.quantity}
              </td>
              <td className="py-2 text-right tabular-nums text-slate-900">
                {formatPrice(item.line_total_cents || item.unit_price_cents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>{t("subtotalHt")}</span>
          <span className="tabular-nums">
            {formatPrice(sale.subtotal_cents || sale.total_cents)}
          </span>
        </div>
        {sale.discount_cents > 0 ? (
          <div className="flex justify-between text-green-700">
            <span>{t("discount")}</span>
            <span className="tabular-nums">−{formatPrice(sale.discount_cents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-slate-500">
          <span>{t("vatAmount")}</span>
          <span className="tabular-nums">{formatPrice(sale.vat_cents)}</span>
        </div>
        <div className="flex justify-between font-semibold text-slate-900">
          <span>{t("totalTtc")}</span>
          <span className="tabular-nums">{formatPrice(sale.total_cents)}</span>
        </div>
        {sale.status === "partial" ? (
          <div className="flex justify-between text-amber-700">
            <span>{t("paid")}</span>
            <span className="tabular-nums">{formatPrice(sale.amount_paid_cents)}</span>
          </div>
        ) : null}
      </div>

      {payments.length > 0 ? (
        <div className="mb-4 space-y-1 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("payments")}
          </p>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between text-slate-600">
              <span>
                {t(`methods.${p.method as "cash"}`, { defaultValue: p.method })}
                {p.reference ? ` (${p.reference})` : ""}
              </span>
              <span className="tabular-nums">{formatPrice(p.amount_cents)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {sale.notes ? (
        <p className="mb-4 text-xs italic text-slate-400">{sale.notes}</p>
      ) : null}

      {settings.ticket_footer ? (
        <p className="whitespace-pre-line border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
          {settings.ticket_footer}
        </p>
      ) : (
        <p className="border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-400">
          {t("thanks")}
        </p>
      )}
    </div>
  );
}
