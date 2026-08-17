"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import type { VoucherTemplateRow } from "@/lib/institut/voucher-pdf";
import type { ActionResult } from "../../caisse-actions";
import {
  createCreditNoteAction,
  issueGiftCardAction,
  issueVoucherAction,
} from "../../caisse-session-actions";

type VoucherKind = "voucher" | "gift_card" | "credit_note";

export type IssueDialogSale = {
  id: string;
  ticket_number: string | null;
  amount_paid_cents: number;
};

const initial: ActionResult = {};

export function IssueVoucherDialog({
  open,
  onClose,
  templates,
  sales,
  defaultKind = "voucher",
}: {
  open: boolean;
  onClose: () => void;
  templates: VoucherTemplateRow[];
  sales: IssueDialogSale[];
  defaultKind?: VoucherKind;
}) {
  const t = useTranslations("pos.vouchers.issueDialog");
  const tTypes = useTranslations("pos.vouchers.types");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [kind, setKind] = useState<VoucherKind>(defaultKind);

  const [voucherState, voucherAction, voucherPending] = useActionState(
    issueVoucherAction,
    initial,
  );
  const [giftState, giftAction, giftPending] = useActionState(
    issueGiftCardAction,
    initial,
  );
  const [creditState, creditAction, creditPending] = useActionState(
    createCreditNoteAction,
    initial,
  );

  const activeState =
    kind === "voucher"
      ? voucherState
      : kind === "gift_card"
        ? giftState
        : creditState;
  const activeAction =
    kind === "voucher"
      ? voucherAction
      : kind === "gift_card"
        ? giftAction
        : creditAction;
  const pending =
    kind === "voucher"
      ? voucherPending
      : kind === "gift_card"
        ? giftPending
        : creditPending;

  useEffect(() => {
    if (activeState.ok) {
      router.refresh();
    }
  }, [activeState.ok, router]);

  return (
    <FormDialog open={open} onClose={onClose} title={t("title")} size="lg">
      <form action={activeAction} className="space-y-4">
        <Field label={t("typeLabel")} htmlFor="voucher_kind">
          <Select
            id="voucher_kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as VoucherKind)}
          >
            <option value="voucher">{tTypes("voucher")}</option>
            <option value="gift_card">{tTypes("gift_card")}</option>
            <option value="credit_note">{tTypes("credit_note")}</option>
          </Select>
        </Field>

        {kind === "voucher" ? (
          <VoucherFields />
        ) : kind === "gift_card" ? (
          <GiftCardFields templates={templates} />
        ) : (
          <CreditNoteFields sales={sales} />
        )}

        {activeState.error ? (
          <p className="text-sm text-red-600">{activeState.error}</p>
        ) : null}
        {activeState.ok ? (
          <div className="space-y-1 text-sm text-emerald-700">
            <p>{activeState.message}</p>
            {activeState.voucherId ? (
              <Link
                href={`/api/institut/vouchers/${activeState.voucherId}/pdf`}
                target="_blank"
                className="underline"
              >
                {t("downloadPdf")}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("close")}
          </Button>
          <Button
            type="submit"
            disabled={pending || (kind === "credit_note" && sales.length === 0)}
          >
            {pending ? tCommon("saving") : t("submit")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function VoucherFields() {
  const t = useTranslations("pos.vouchers.issueDialog");
  return (
    <>
      <input type="hidden" name="voucher_type" value="voucher" />
      <Field label={t("amount")} htmlFor="voucher_amount">
        <Input
          id="voucher_amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          required
        />
      </Field>
      <Field label={t("codeOptional")} htmlFor="voucher_code">
        <Input id="voucher_code" name="code" placeholder={t("codeAuto")} />
      </Field>
      <Field label={t("recipientOptional")} htmlFor="voucher_recipient">
        <Input id="voucher_recipient" name="recipient_name" />
      </Field>
      <Field label={t("expiresAt")} htmlFor="voucher_expires">
        <Input id="voucher_expires" name="expires_at" type="date" />
      </Field>
    </>
  );
}

function GiftCardFields({ templates }: { templates: VoucherTemplateRow[] }) {
  const t = useTranslations("pos.vouchers.issueDialog");
  return (
    <>
      <Field label={t("amount")} htmlFor="gift_amount">
        <Input
          id="gift_amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          required
        />
      </Field>
      <Field label={t("recipientOptional")} htmlFor="gift_recipient">
        <Input id="gift_recipient" name="recipient_name" />
      </Field>
      <Field label={t("message")} htmlFor="gift_message">
        <Input
          id="gift_message"
          name="message"
          placeholder={t("messagePlaceholder")}
        />
      </Field>
      <Field label={t("template")} htmlFor="gift_template">
        <Select id="gift_template" name="template_id" defaultValue="">
          <option value="">{t("templateDefault")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
              {tpl.is_default ? ` (${t("defaultTag")})` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

function CreditNoteFields({ sales }: { sales: IssueDialogSale[] }) {
  const t = useTranslations("pos.vouchers.issueDialog");
  return (
    <>
      <Field label={t("selectSale")} htmlFor="credit_sale">
        <Select id="credit_sale" name="sale_id" required defaultValue="">
          <option value="" disabled>
            {t("selectSale")}
          </option>
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ticket_number ? `Ticket n° ${s.ticket_number}` : s.id.slice(0, 8)} ·{" "}
              {(s.amount_paid_cents / 100).toFixed(2)} €
            </option>
          ))}
        </Select>
      </Field>
      {sales.length === 0 ? (
        <p className="text-xs text-slate-500">{t("noSalesHint")}</p>
      ) : null}
      <Field label={t("amount")} htmlFor="credit_amount">
        <Input
          id="credit_amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          required
        />
      </Field>
      <Field label={t("reason")} htmlFor="credit_reason">
        <Textarea id="credit_reason" name="reason" rows={2} required minLength={3} />
      </Field>
    </>
  );
}
