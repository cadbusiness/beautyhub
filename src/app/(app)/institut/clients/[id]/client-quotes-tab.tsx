"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  cancelQuote,
  createQuoteForClient,
  sendQuote,
  type QuoteActionResult,
} from "@/app/(app)/institut/quote-actions";
import type { ClientQuote } from "@/lib/institut/commercial-documents";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  DataTable,
  dataTableCell,
  dataTableHead,
  dataTableRow,
} from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";

type LineDraft = {
  id: string;
  label: string;
  quantity: string;
  unit_price_euros: string;
};

const initial: QuoteActionResult = {};

function newLine(): LineDraft {
  return {
    id: crypto.randomUUID(),
    label: "",
    quantity: "1",
    unit_price_euros: "0",
  };
}

function eurosToCents(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function QuoteFormDialog({
  open,
  onClose,
  clientId,
  sourceQuote,
  defaultServiceName,
  defaultPriceCents,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  sourceQuote?: ClientQuote | null;
  defaultServiceName?: string | null;
  defaultPriceCents?: number;
}) {
  const t = useTranslations("institut.quotes.form");
  const tCommon = useTranslations("common");
  const [lines, setLines] = useState<LineDraft[]>(() => [
    {
      id: crypto.randomUUID(),
      label: defaultServiceName ?? "",
      quantity: "1",
      unit_price_euros: defaultPriceCents ? (defaultPriceCents / 100).toFixed(2) : "0",
    },
  ]);
  const [state, formAction, pending] = useActionState(createQuoteForClient, initial);

  useEffect(() => {
    if (!open) return;
    setLines([
      {
        id: crypto.randomUUID(),
        label: defaultServiceName ?? sourceQuote?.service_name ?? "",
        quantity: "1",
        unit_price_euros: defaultPriceCents
          ? (defaultPriceCents / 100).toFixed(2)
          : sourceQuote?.total_cents
            ? (sourceQuote.total_cents / 100).toFixed(2)
            : "0",
      },
    ]);
  }, [open, defaultServiceName, defaultPriceCents, sourceQuote]);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const linesJson = JSON.stringify(
    lines
      .filter((l) => l.label.trim())
      .map((l) => ({
        label: l.label.trim(),
        quantity: Number.parseFloat(l.quantity.replace(",", ".")) || 1,
        unit_price_cents: eurosToCents(l.unit_price_euros),
      })),
  );

  const defaultValidUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <FormDialog open={open} onClose={onClose} title={t("title")}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="client_id" value={clientId} />
        {sourceQuote ? (
          <>
            <input type="hidden" name="source_document_id" value={sourceQuote.id} />
            {sourceQuote.service_id ? (
              <input type="hidden" name="service_id" value={sourceQuote.service_id} />
            ) : null}
          </>
        ) : null}
        <input type="hidden" name="lines_json" value={linesJson} />

        {sourceQuote?.client_message ? (
          <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
            <p className="font-medium">{t("clientMessage")}</p>
            <p className="mt-1 whitespace-pre-line">{sourceQuote.client_message}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">{t("lines")}</p>
          {lines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-[1fr_72px_96px_auto] gap-2">
              <Input
                placeholder={t("lineLabel")}
                value={line.label}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((row) =>
                      row.id === line.id ? { ...row, label: e.target.value } : row,
                    ),
                  )
                }
                required={index === 0}
              />
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((row) =>
                      row.id === line.id ? { ...row, quantity: e.target.value } : row,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                value={line.unit_price_euros}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((row) =>
                      row.id === line.id ? { ...row, unit_price_euros: e.target.value } : row,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 px-2"
                disabled={lines.length <= 1}
                onClick={() => setLines((prev) => prev.filter((row) => row.id !== line.id))}
              >
                ×
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="h-9" onClick={() => setLines((p) => [...p, newLine()])}>
            {t("addLine")}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("validUntil")} htmlFor="valid_until">
            <Input id="valid_until" name="valid_until" type="date" defaultValue={defaultValidUntil} />
          </Field>
          <Field label={t("template")} htmlFor="template_id">
            <select
              id="template_id"
              name="template_id"
              defaultValue="elegant"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="elegant">{t("templates.elegant")}</option>
              <option value="minimal">{t("templates.minimal")}</option>
              <option value="wedding">{t("templates.wedding")}</option>
              <option value="artist">{t("templates.artist")}</option>
            </select>
          </Field>
        </div>

        <Field label={t("internalNotes")} htmlFor="internal_notes">
          <Textarea id="internal_notes" name="internal_notes" rows={2} />
        </Field>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function QuoteStatusBadge({ status }: { status: ClientQuote["status"] }) {
  const t = useTranslations("institut.quotes.status");
  const colors: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800",
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-50 text-blue-800",
    accepted: "bg-emerald-50 text-emerald-800",
    declined: "bg-slate-100 text-slate-600",
    expired: "bg-orange-50 text-orange-800",
    cancelled: "bg-red-50 text-red-700",
    converted: "bg-violet-50 text-violet-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.draft}`}>
      {t(status)}
    </span>
  );
}

export function ClientQuotesTab({
  clientId,
  quotes,
  onRefresh,
}: {
  clientId: string;
  quotes: ClientQuote[];
  onRefresh: () => void;
}) {
  const t = useTranslations("institut.quotes");
  const tCommon = useTranslations("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceQuote, setSourceQuote] = useState<ClientQuote | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pendingRequests = quotes.filter(
    (q) => q.doc_type === "quote_request" && q.status === "pending",
  );

  async function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/devis/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 lg:px-6">
        <p className="text-sm text-slate-600">{t("hint")}</p>
        <Button className="h-9" onClick={() => { setSourceQuote(null); setCreateOpen(true); }}>
          {t("newQuote")}
        </Button>
      </div>

      {pendingRequests.length > 0 ? (
        <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("pendingRequests")}
          </h2>
          <ul className="space-y-2">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{req.service_name ?? tCommon("service")}</p>
                  {req.client_message ? (
                    <p className="mt-0.5 line-clamp-2 text-slate-600">{req.client_message}</p>
                  ) : null}
                  {req.event_date ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t("eventDate")} {new Date(req.event_date).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setSourceQuote(req);
                    setCreateOpen(true);
                  }}
                >
                  {t("createFromRequest")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DataTable empty={quotes.length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.date")}</th>
              <th className={dataTableHead}>{t("columns.number")}</th>
              <th className={dataTableHead}>{t("columns.type")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={`text-right ${dataTableHead}`}>{t("columns.total")}</th>
              <th className={`w-48 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className={dataTableRow}>
                <td className={`text-slate-600 ${dataTableCell}`}>{formatDateTime(quote.created_at)}</td>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                  {quote.doc_number ?? tCommon("dash")}
                </td>
                <td className={dataTableCell}>
                  {quote.doc_type === "quote_request" ? t("typeRequest") : t("typeQuote")}
                </td>
                <td className={dataTableCell}>
                  <QuoteStatusBadge status={quote.status} />
                </td>
                <td className={`text-right tabular-nums ${dataTableCell}`}>
                  {quote.total_cents > 0 ? formatPrice(quote.total_cents) : tCommon("dash")}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  {quote.doc_type === "quote" ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {quote.status === "draft" ? (
                        <form action={sendQuote} onSubmit={() => setTimeout(onRefresh, 300)}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="client_id" value={clientId} />
                          <Button type="submit" variant="outline" className="h-8">
                            {t("send")}
                          </Button>
                        </form>
                      ) : null}
                      {["sent", "accepted"].includes(quote.status) ? (
                        <Button
                          variant="outline"
                          className="h-8"
                          onClick={() => void copyLink(quote.public_token, quote.id)}
                        >
                          {copiedId === quote.id ? t("copied") : t("copyLink")}
                        </Button>
                      ) : null}
                      {!["cancelled", "declined", "converted"].includes(quote.status) ? (
                        <form action={cancelQuote} onSubmit={() => setTimeout(onRefresh, 300)}>
                          <input type="hidden" name="quote_id" value={quote.id} />
                          <input type="hidden" name="client_id" value={clientId} />
                          <Button type="submit" variant="outline" className="h-8 text-red-600">
                            {tCommon("cancel")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      <QuoteFormDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSourceQuote(null);
          onRefresh();
        }}
        clientId={clientId}
        sourceQuote={sourceQuote}
        defaultServiceName={sourceQuote?.service_name}
        defaultPriceCents={sourceQuote?.total_cents}
      />
    </>
  );
}
