"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createCreditNoteAction } from "../../caisse-session-actions";
import type { ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

export function CreditNoteForm({
  sales,
}: {
  sales: Array<{
    id: string;
    ticket_number: string | null;
    total_cents: number;
    amount_paid_cents: number;
  }>;
}) {
  const t = useTranslations("pos.vouchers.creditForm");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createCreditNoteAction, initial);

  return (
    <form action={action} className="space-y-3">
      <Select name="sale_id" required defaultValue="">
        <option value="" disabled>
          {t("selectSale")}
        </option>
        {sales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.ticket_number ?? s.id.slice(0, 8)} · {(s.amount_paid_cents / 100).toFixed(2)} €
          </option>
        ))}
      </Select>
      {sales.length === 0 ? (
        <p className="text-xs text-slate-400">{t("noSalesHint")}</p>
      ) : null}
      <Input name="amount" type="number" min={0} step="0.01" placeholder={t("amount")} required />
      <Textarea name="reason" placeholder={t("reason")} rows={2} />
      <Button type="submit" disabled={pending || sales.length === 0}>
        {pending ? tCommon("saving") : t("submit")}
      </Button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
    </form>
  );
}
