"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { issueVoucherAction } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

export function VoucherForm() {
  const t = useTranslations("pos.vouchers.voucherForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(issueVoucherAction, initial);

  return (
    <form action={action} className="space-y-3">
      <Select name="voucher_type" defaultValue="voucher">
        <option value="voucher">{t("typeVoucher")}</option>
        <option value="gift_card">{t("typeGiftCard")}</option>
        <option value="credit_note">{t("typeCreditNote")}</option>
      </Select>
      <Input name="amount" type="number" min={0} step="0.01" placeholder={t("amount")} required />
      <Input name="code" placeholder={t("codeOptional")} />
      <Input name="recipient_name" placeholder={t("recipientOptional")} />
      <Input name="expires_at" type="date" />
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
