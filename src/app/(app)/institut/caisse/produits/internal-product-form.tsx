"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createInternalProduct, type ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function InternalProductForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("pos.products.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createInternalProduct, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label={tCommon("name")} htmlFor="name">
        <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("priceEur")} htmlFor="price">
          <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue="0" />
        </Field>
        <Field label={tCommon("stock")} htmlFor="stock_quantity">
          <Input
            id="stock_quantity"
            name="stock_quantity"
            type="number"
            min={0}
            placeholder={t("stockOptional")}
          />
        </Field>
      </div>
      <Field label={tCommon("sku")} htmlFor="sku">
        <Input id="sku" name="sku" placeholder={t("skuOptional")} />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
