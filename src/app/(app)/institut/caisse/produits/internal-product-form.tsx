"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  createInternalProduct,
  updateInternalProduct,
  type ActionResult,
} from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const initial: ActionResult = {};

export type InternalProductFormValues = {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  stock_quantity: number | null;
  category_id: string | null;
};

export function InternalProductForm({
  categories,
  product,
  defaultCategoryId,
  onSuccess,
}: {
  categories: Array<{ id: string; name: string }>;
  product?: InternalProductFormValues | null;
  defaultCategoryId?: string | null;
  onSuccess?: () => void;
}) {
  const t = useTranslations("pos.products.form");
  const tCommon = useTranslations("common");
  const isEdit = Boolean(product);
  const [state, action, pending] = useActionState(
    isEdit ? updateInternalProduct : createInternalProduct,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <Field label={tCommon("name")} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          defaultValue={product?.name ?? ""}
          placeholder={t("namePlaceholder")}
        />
      </Field>
      {categories.length > 0 ? (
        <Field label={t("category")} htmlFor="category_id">
          <Select
            id="category_id"
            name="category_id"
            defaultValue={product?.category_id ?? defaultCategoryId ?? ""}
          >
            <option value="">{t("categoryNone")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("priceEur")} htmlFor="price">
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product ? (product.price_cents / 100).toFixed(2) : "0"}
          />
        </Field>
        <Field label={tCommon("stock")} htmlFor="stock_quantity">
          <Input
            id="stock_quantity"
            name="stock_quantity"
            type="number"
            min={0}
            defaultValue={product?.stock_quantity ?? ""}
            placeholder={t("stockOptional")}
          />
        </Field>
      </div>
      <Field label={tCommon("sku")} htmlFor="sku">
        <Input
          id="sku"
          name="sku"
          defaultValue={product?.sku ?? ""}
          placeholder={t("skuOptional")}
        />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? (isEdit ? t("saving") : t("submitting")) : isEdit ? t("save") : t("submit")}
      </Button>
    </form>
  );
}
