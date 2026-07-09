"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { syncWooProductsAction, type SyncWooResult } from "../woo-actions";
import { Button } from "@/components/ui/button";

const initialState: SyncWooResult = {};

export function SyncWooButton() {
  const t = useTranslations("institut.pos");
  const [state, action, pending] = useActionState(syncWooProductsAction, initialState);

  return (
    <form action={action} className="flex items-center gap-2">
      <Button variant="outline" type="submit" className="h-9" disabled={pending}>
        {pending ? t("syncWooPending") : t("syncWoo")}
      </Button>
      {state.ok ? (
        <span className="text-xs text-slate-500">
          {t("syncWooDone", {
            products: state.syncedCount ?? 0,
            shops: state.shopsCount ?? 0,
          })}
        </span>
      ) : null}
      {state.error ? <span className="text-xs text-red-600">{t("syncWooError")}</span> : null}
    </form>
  );
}
