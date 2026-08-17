"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { dataTableCellCompact } from "@/components/ui/data-table";

export type HistorySaleItem = {
  name: string;
  quantity: number;
  lineTotalCents: number;
};

export type HistorySalePayment = {
  method: string;
  amountCents: number;
};

export type HistorySaleDoc = {
  id: string;
  docType: string;
  docNumber: string;
};

export type HistorySale = {
  id: string;
  ticketNumber: string | null;
  createdAtLabel: string;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  status: string;
  paymentMethod: string;
  clientLabel: string | null;
  items: HistorySaleItem[];
  payments: HistorySalePayment[];
  documents: HistorySaleDoc[];
};

function paymentLabel(
  t: ReturnType<typeof useTranslations<"pos.history">>,
  method: string,
) {
  return t(`paymentMethods.${method as "cash"}`, { defaultValue: method });
}

export function SalesHistoryAccordion({ sales }: { sales: HistorySale[] }) {
  const t = useTranslations("pos.history");
  const tDocs = useTranslations("pos.sales");
  const tCommon = useTranslations("common");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-slate-100">
      {sales.map((sale) => {
        const open = openId === sale.id;
        const extraDocs = sale.documents.filter((d) => d.docType !== "ticket");
        const ticketDoc = sale.documents.find((d) => d.docType === "ticket");
        const statusKey = sale.status as "paid" | "partial";
        const paymentSummary =
          sale.payments.length > 1
            ? t("mixedPayments", { count: sale.payments.length })
            : sale.payments.length === 1
              ? paymentLabel(t, sale.payments[0].method)
              : paymentLabel(t, sale.paymentMethod);

        return (
          <li key={sale.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : sale.id)}
              className={cn(
                "flex w-full items-center gap-3 text-left transition-colors hover:bg-slate-50/70",
                dataTableCellCompact,
              )}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                  open ? "rotate-0" : "-rotate-90",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {sale.ticketNumber ?? t("viewTicket")}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {sale.createdAtLabel}
                  {sale.clientLabel ? ` · ${sale.clientLabel}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-slate-900">
                  {formatPrice(sale.totalCents, sale.currency)}
                </span>
                <span
                  className={cn(
                    "block text-xs",
                    statusKey === "partial" ? "text-amber-600" : "text-slate-500",
                  )}
                >
                  {t(`status.${statusKey}`, { defaultValue: sale.status })}
                </span>
              </span>
            </button>

            {open ? (
              <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 lg:px-6">
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-xs text-slate-500">{t("columns.client")}</dt>
                    <dd className="text-slate-900">
                      {sale.clientLabel ?? tCommon("dash")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-xs text-slate-500">{t("columns.payment")}</dt>
                    <dd className="text-slate-900">{paymentSummary}</dd>
                  </div>
                </dl>

                {sale.items.length > 0 ? (
                  <ul className="divide-y divide-slate-200">
                    {sale.items.map((item, index) => (
                      <li
                        key={`${sale.id}-item-${index}`}
                        className="flex items-baseline justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 text-slate-700">
                          <span className="tabular-nums text-slate-500">
                            {item.quantity}×
                          </span>{" "}
                          {item.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-900">
                          {formatPrice(item.lineTotalCents, sale.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{t("noItems")}</p>
                )}

                {sale.payments.length > 0 ? (
                  <ul className="space-y-0.5 text-xs text-slate-500">
                    {sale.payments.map((payment, index) => (
                      <li
                        key={`${sale.id}-pay-${index}`}
                        className="flex justify-between gap-3"
                      >
                        <span>{paymentLabel(t, payment.method)}</span>
                        <span className="tabular-nums">
                          {formatPrice(payment.amountCents, sale.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {sale.status === "partial" ? (
                  <p className="text-xs text-amber-700">
                    {t("paidShort")} {formatPrice(sale.amountPaidCents, sale.currency)}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link
                    href={
                      ticketDoc
                        ? `/institut/caisse/documents/${ticketDoc.id}`
                        : `/institut/caisse/ticket/${sale.id}`
                    }
                    className="font-medium text-slate-800 underline"
                  >
                    {t("viewTicket")}
                  </Link>
                  {extraDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/institut/caisse/documents/${doc.id}`}
                      className="text-slate-700 underline"
                      title={doc.docNumber}
                    >
                      {tDocs(`types.${doc.docType as "invoice"}`, {
                        defaultValue: doc.docType,
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
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
