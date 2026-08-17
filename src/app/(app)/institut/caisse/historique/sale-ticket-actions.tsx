"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ActionResult } from "../../caisse-actions";
import { createCreditNoteAction } from "../../caisse-session-actions";
import type { HistorySale } from "./sales-history-accordion";

const initial: ActionResult = {};

type Intent = "credit" | "refund" | "replacement";

export function SaleTicketActions({ sale }: { sale: HistorySale }) {
  const t = useTranslations("pos.history.ticketActions");
  const [open, setOpen] = useState(false);
  const remaining = Math.max(0, sale.amountPaidCents - sale.creditedCents);
  if (sale.status === "refunded" || remaining <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white"
      >
        {t("open")}
      </button>
      {open ? (
        <SaleTicketActionsDialog
          sale={sale}
          remainingCents={remaining}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SaleTicketActionsDialog({
  sale,
  remainingCents,
  open,
  onClose,
}: {
  sale: HistorySale;
  remainingCents: number;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("pos.history.ticketActions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>("credit");
  const [settlement, setSettlement] = useState<"cash" | "card">("cash");
  const [state, action, pending] = useActionState(createCreditNoteAction, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    if (intent === "replacement") {
      router.push("/institut/caisse");
    }
  }, [state.ok, intent, router]);

  const submitLabel =
    intent === "refund"
      ? t("submitRefund")
      : intent === "replacement"
        ? t("submitReplace")
        : t("submit");

  return (
    <FormDialog open={open} onClose={onClose} title={t("title")}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="sale_id" value={sale.id} />
        <input type="hidden" name="intent" value={intent} />
        <input
          type="hidden"
          name="settlement"
          value={intent === "refund" ? settlement : "credit"}
        />

        <p className="text-xs leading-5 text-slate-500">{t("legalHint")}</p>

        <fieldset className="space-y-2">
          <IntentOption
            selected={intent === "credit"}
            title={t("credit")}
            hint={t("creditHint")}
            onSelect={() => setIntent("credit")}
          />
          <IntentOption
            selected={intent === "refund"}
            title={t("refund")}
            hint={t("refundHint")}
            onSelect={() => setIntent("refund")}
          />
          <IntentOption
            selected={intent === "replacement"}
            title={t("replace")}
            hint={t("replaceHint")}
            onSelect={() => setIntent("replacement")}
          />
        </fieldset>

        {intent === "refund" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSettlement("cash")}
              className={cn(
                "h-9 flex-1 rounded-lg border text-sm font-medium",
                settlement === "cash"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900",
              )}
            >
              {t("settlementCash")}
            </button>
            <button
              type="button"
              onClick={() => setSettlement("card")}
              className={cn(
                "h-9 flex-1 rounded-lg border text-sm font-medium",
                settlement === "card"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900",
              )}
            >
              {t("settlementCard")}
            </button>
          </div>
        ) : null}

        <Field label={`${t("amount")} · ${t("remaining", { amount: formatPrice(remainingCents, sale.currency) })}`} htmlFor="ticket_action_amount">
          <Input
            id="ticket_action_amount"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            defaultValue={(remainingCents / 100).toFixed(2)}
          />
        </Field>
        <Field label={t("reason")} htmlFor="ticket_action_reason">
          <Textarea
            id="ticket_action_reason"
            name="reason"
            rows={2}
            required
            minLength={3}
            placeholder={t("reasonPlaceholder")}
          />
        </Field>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("close")}
          </Button>
          <Button type="submit" disabled={pending || Boolean(state.ok)}>
            {pending ? tCommon("saving") : submitLabel}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function IntentOption({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left",
        selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white",
      )}
    >
      <span className="block text-sm font-medium text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
    </button>
  );
}
