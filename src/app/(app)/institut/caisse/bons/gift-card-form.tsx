"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { issueGiftCardAction } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function GiftCardForm() {
  const t = useTranslations("pos.vouchers.giftForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(issueGiftCardAction, initial);

  return (
    <form action={action} className="space-y-3">
      <Input name="amount" type="number" min={0} step="0.01" placeholder={t("amount")} required />
      <Input name="recipient_name" placeholder={t("recipient")} />
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
