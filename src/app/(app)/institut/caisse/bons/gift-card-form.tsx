"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { issueGiftCardAction } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import type { VoucherTemplateRow } from "@/lib/institut/voucher-pdf";

const initial: ActionResult = {};

export function GiftCardForm({ templates }: { templates: VoucherTemplateRow[] }) {
  const t = useTranslations("pos.vouchers.giftForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(issueGiftCardAction, initial);

  return (
    <form action={action} className="space-y-3">
      <Field label={t("amount")} htmlFor="gift_amount">
        <Input
          id="gift_amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          placeholder={t("amount")}
          required
        />
      </Field>
      <Field label={t("recipient")} htmlFor="gift_recipient">
        <Input id="gift_recipient" name="recipient_name" placeholder={t("recipient")} />
      </Field>
      <Field label={t("message")} htmlFor="gift_message">
        <Input id="gift_message" name="message" placeholder={t("messagePlaceholder")} />
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
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <div className="space-y-1 text-sm text-green-700">
          <p>{state.message}</p>
          {state.voucherId ? (
            <Link
              href={`/api/institut/vouchers/${state.voucherId}/pdf`}
              className="underline"
              target="_blank"
            >
              {t("downloadPdf")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
