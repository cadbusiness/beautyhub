import { getFormatter, getTranslations } from "next-intl/server";
import { formatPrice } from "@/lib/utils";
import type { SaleDocumentPayload } from "@/lib/institut/sale-documents/types";

type DocumentLabels = {
  reference: string;
  date: string;
  attention: (name: string) => string;
  client: string;
  seller: string;
  register: string;
  ticketSale: string;
  subtotalHt: string;
  vatAmount: string;
  totalTtc: string;
  paymentTerms: string;
  paymentLine: (date: string, method: string) => string;
  balanceInvoice: (number: string) => string;
  invoiceSettled: string;
  deliverySignature: string;
  columns: {
    reference: string;
    description: string;
    qty: string;
    unitTtc: string;
    discount: string;
    totalTtc: string;
    vat: string;
  };
  vatTable: {
    rate: string;
    base: string;
    amount: string;
  };
  ticketVatCode: string;
  ticketVatRate: string;
  ticketVatBase: string;
  ticketVatAmount: string;
};

function paymentMethodLabel(method: string, labels: Record<string, string>): string {
  return labels[method] ?? method;
}

function FormalDocument({
  payload,
  title,
  labels,
  format,
  locale,
  methodLabels,
}: {
  payload: SaleDocumentPayload;
  title: string;
  labels: DocumentLabels;
  format: Awaited<ReturnType<typeof getFormatter>>;
  locale: string;
  methodLabels: Record<string, string>;
}) {
  const date = format.dateTime(new Date(payload.issuedAt), { dateStyle: "short" });
  const groupSuffix = payload.saleGroupNumber ? ` / ${payload.saleGroupNumber}` : "";
  const invoiceDoc = payload.relatedDocuments.find((doc) => doc.docType === "invoice");
  const isPaid = payload.status === "settled" || payload.status === "paid";
  const primaryPayment = payload.payments[0];

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-sm text-slate-900 print:p-4">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {title}
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{payload.legalName}</h1>
            {payload.legalAddress ? (
              <p className="mt-2 whitespace-pre-line text-slate-600">{payload.legalAddress}</p>
            ) : null}
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="text-slate-500">{labels.reference} :</span>{" "}
              <span className="font-medium">
                {payload.docNumber}
                {groupSuffix}
              </span>
            </p>
            <p className="mt-1">
              <span className="text-slate-500">{labels.date} :</span> {date}
            </p>
          </div>
        </div>
      </header>

      {payload.clientName ? (
        <div className="mb-6">
          <p className="font-medium">{payload.clientName}</p>
          <p className="text-slate-600">{labels.attention(payload.clientName)}</p>
          {payload.clientEmail ? (
            <p className="text-xs text-slate-500">{payload.clientEmail}</p>
          ) : null}
        </div>
      ) : null}

      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">{labels.columns.reference}</th>
            <th className="py-2 pr-3">{labels.columns.description}</th>
            <th className="py-2 pr-3 text-right">{labels.columns.qty}</th>
            <th className="py-2 pr-3 text-right">{labels.columns.unitTtc}</th>
            <th className="py-2 pr-3 text-right">{labels.columns.discount}</th>
            <th className="py-2 pr-3 text-right">{labels.columns.totalTtc}</th>
            <th className="py-2 text-right">{labels.columns.vat}</th>
          </tr>
        </thead>
        <tbody>
          {payload.lines.map((line, index) => (
            <tr key={index} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                {line.reference ?? "—"}
              </td>
              <td className="py-2 pr-3">{line.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatPrice(Math.abs(line.unitPriceCents), payload.currency, locale)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {line.discountCents > 0
                  ? formatPrice(line.discountCents, payload.currency, locale)
                  : "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatPrice(line.lineTotalCents, payload.currency, locale)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {Math.round(line.vatRateBps / 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-2 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
        <p>{payload.legalMentions.paymentDiscount}</p>
        <p>{payload.legalMentions.latePaymentPenalty}</p>
        <p>{payload.legalMentions.fixedRecoveryFee}</p>
        <p>{payload.legalMentions.retentionOfTitle}</p>
        <p>{payload.legalMentions.jurisdiction}</p>
      </div>

      <div className="mt-6 grid gap-4 border border-slate-200 lg:grid-cols-[1fr_280px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">{labels.vatTable.rate}</th>
              <th className="px-3 py-2 text-right">{labels.vatTable.base}</th>
              <th className="px-3 py-2 text-right">{labels.vatTable.amount}</th>
            </tr>
          </thead>
          <tbody>
            {payload.vatRows.map((row) => (
              <tr key={row.rateLabel} className="border-b border-slate-100">
                <td className="px-3 py-2">{row.rateLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPrice(row.baseCents, payload.currency, locale)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPrice(row.vatCents, payload.currency, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-l border-slate-200 p-4 text-sm">
          <p className="text-xs uppercase text-slate-500">{labels.paymentTerms}</p>
          {primaryPayment ? (
            <p className="mt-2">
              {labels.paymentLine(
                date,
                paymentMethodLabel(primaryPayment.method, methodLabels),
              )}
            </p>
          ) : null}
          {payload.docType === "delivery_note" && invoiceDoc ? (
            <p className="mt-2 text-slate-600">
              {labels.balanceInvoice(invoiceDoc.docNumber)}
            </p>
          ) : null}
          {payload.docType === "invoice" && isPaid ? (
            <p className="mt-3 font-medium text-green-700">{labels.invoiceSettled}</p>
          ) : null}
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-3">
            <div className="flex justify-between">
              <span>{labels.subtotalHt}</span>
              <span className="tabular-nums">
                {formatPrice(payload.subtotalCents, payload.currency, locale)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{labels.vatAmount}</span>
              <span className="tabular-nums">
                {formatPrice(payload.vatCents, payload.currency, locale)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{labels.totalTtc}</span>
              <span className="tabular-nums">
                {formatPrice(payload.totalCents, payload.currency, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {payload.docType === "delivery_note" ? (
        <p className="mt-6 text-xs text-slate-500">{labels.deliverySignature}</p>
      ) : null}

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        {payload.legalAddress ? <p>{payload.legalAddress}</p> : null}
        {payload.legalEmail ? <p>{payload.legalEmail}</p> : null}
        {payload.vatNumber ? (
          <p>
            {payload.vatLabel}: {payload.vatNumber}
          </p>
        ) : null}
        {payload.companyId ? (
          <p>
            {payload.companyIdLabel}: {payload.companyId}
          </p>
        ) : null}
      </footer>
    </div>
  );
}

function TicketDocument({
  payload,
  labels,
  format,
  locale,
  methodLabels,
}: {
  payload: SaleDocumentPayload;
  labels: DocumentLabels;
  format: Awaited<ReturnType<typeof getFormatter>>;
  locale: string;
  methodLabels: Record<string, string>;
}) {
  const date = format.dateTime(new Date(payload.issuedAt), {
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <div className="mx-auto max-w-sm bg-white p-6 font-mono text-[13px] leading-5 text-slate-900 print:p-3">
      <div className="text-center">
        <p className="text-2xl font-semibold tabular-nums">
          {formatPrice(payload.totalCents, payload.currency, locale)}
        </p>
        <p className="mt-2 text-sm font-sans font-semibold">{payload.legalName}</p>
        {payload.legalAddress ? (
          <p className="whitespace-pre-line font-sans text-xs text-slate-600">
            {payload.legalAddress}
          </p>
        ) : null}
        {payload.companyId ? (
          <p className="font-sans text-xs text-slate-500">
            {payload.companyIdLabel} {payload.companyId}
          </p>
        ) : null}
      </div>

      <div className="my-4 border-y border-dashed border-slate-300 py-3 font-sans text-xs">
        <p>{labels.ticketSale}</p>
        <p>
          {labels.date} : {date}
        </p>
        {payload.cashSessionLabel ? (
          <p>
            {labels.register} : {payload.cashSessionLabel}
          </p>
        ) : null}
        {payload.staffName ? (
          <p>
            {labels.seller} : {payload.staffName}
          </p>
        ) : null}
        {payload.clientName ? (
          <p>
            {labels.client} : {payload.clientName}
          </p>
        ) : null}
        <p>
          {labels.reference} : {payload.docNumber}
          {payload.saleGroupNumber ? ` / ${payload.saleGroupNumber}` : ""}
        </p>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[24px_1fr_72px] gap-2 text-xs uppercase text-slate-500">
          <span>{labels.columns.qty}</span>
          <span>{labels.columns.description}</span>
          <span className="text-right">{labels.columns.totalTtc}</span>
        </div>
        {payload.lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[24px_1fr_72px] gap-2">
            <span>{line.quantity}</span>
            <span className="truncate">{line.name}</span>
            <span className="text-right tabular-nums">
              {formatPrice(line.lineTotalCents, payload.currency, locale)}
            </span>
          </div>
        ))}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300 pt-3">
        <div className="flex justify-between font-semibold">
          <span>{labels.totalTtc}</span>
          <span className="tabular-nums">
            {formatPrice(payload.totalCents, payload.currency, locale)}
          </span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="grid grid-cols-4 gap-2 uppercase text-slate-500">
          <span>{labels.ticketVatCode}</span>
          <span>{labels.ticketVatRate}</span>
          <span className="text-right">{labels.ticketVatBase}</span>
          <span className="text-right">{labels.ticketVatAmount}</span>
        </div>
        {payload.vatRows.map((row, index) => (
          <div key={row.rateLabel} className="grid grid-cols-4 gap-2">
            <span>{index + 1}</span>
            <span>{row.rateLabel}</span>
            <span className="text-right tabular-nums">
              {formatPrice(row.baseCents, payload.currency, locale)}
            </span>
            <span className="text-right tabular-nums">
              {formatPrice(row.vatCents, payload.currency, locale)}
            </span>
          </div>
        ))}
      </div>

      {payload.payments.length > 0 ? (
        <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3">
          {payload.payments.map((payment, index) => (
            <div key={index}>
              <p>{paymentMethodLabel(payment.method, methodLabels)}</p>
              {payment.reference ? (
                <p className="text-xs text-slate-500">{payment.reference}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export async function SaleDocumentView({
  payload,
  locale,
}: {
  payload: SaleDocumentPayload;
  locale: string;
}) {
  const t = await getTranslations("pos.documents");
  const format = await getFormatter();

  const labels: DocumentLabels = {
    reference: t("reference"),
    date: t("date"),
    attention: (name) => t("attention", { name }),
    client: t("client"),
    seller: t("seller"),
    register: t("register"),
    ticketSale: t("ticketSale"),
    subtotalHt: t("subtotalHt"),
    vatAmount: t("vatAmount"),
    totalTtc: t("totalTtc"),
    paymentTerms: t("paymentTerms"),
    paymentLine: (date, method) => t("paymentLine", { date, method }),
    balanceInvoice: (number) => t("balanceInvoice", { number }),
    invoiceSettled: t("invoiceSettled"),
    deliverySignature: t("deliverySignature"),
    columns: {
      reference: t("columns.reference"),
      description: t("columns.description"),
      qty: t("columns.qty"),
      unitTtc: t("columns.unitTtc"),
      discount: t("columns.discount"),
      totalTtc: t("columns.totalTtc"),
      vat: t("columns.vat"),
    },
    vatTable: {
      rate: t("vatTable.rate"),
      base: t("vatTable.base"),
      amount: t("vatTable.amount"),
    },
    ticketVatCode: t("ticketVatCode"),
    ticketVatRate: t("ticketVatRate"),
    ticketVatBase: t("ticketVatBase"),
    ticketVatAmount: t("ticketVatAmount"),
  };

  const methodLabels = {
    cash: t("methods.cash"),
    card: t("methods.card"),
    stripe: t("methods.stripe"),
    transfer: t("methods.transfer"),
    voucher: t("methods.voucher"),
    gift_card: t("methods.gift_card"),
    credit_note: t("methods.credit_note"),
    mixed: t("methods.mixed"),
    other: t("methods.other"),
  };

  if (payload.docType === "ticket") {
    return (
      <TicketDocument
        payload={payload}
        labels={labels}
        format={format}
        locale={locale}
        methodLabels={methodLabels}
      />
    );
  }

  if (payload.docType === "credit_note") {
    return (
      <div>
        {payload.originalInvoiceNumber ? (
          <p className="mx-auto mb-4 max-w-4xl px-8 text-sm text-slate-600 print:px-4">
            {t("creditAgainst", { number: payload.originalInvoiceNumber })}
            {payload.creditReason ? ` — ${payload.creditReason}` : ""}
          </p>
        ) : null}
        <FormalDocument
          payload={payload}
          title={t("types.credit_note")}
          labels={labels}
          format={format}
          locale={locale}
          methodLabels={methodLabels}
        />
      </div>
    );
  }

  const title =
    payload.docType === "invoice"
      ? t("types.invoice")
      : payload.docType === "delivery_note"
        ? t("types.delivery_note")
        : t("types.ticket");

  return (
    <FormalDocument
      payload={payload}
      title={title}
      labels={labels}
      format={format}
      locale={locale}
      methodLabels={methodLabels}
    />
  );
}
