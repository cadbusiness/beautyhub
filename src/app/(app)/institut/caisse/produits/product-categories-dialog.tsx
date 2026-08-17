"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  createInternalProductCategory,
  deleteInternalProductCategory,
  updateInternalProductCategory,
  type ActionResult,
} from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input } from "@/components/ui/input";
import type { ProductCategoryRow } from "@/lib/institut/internal-products";

const initial: ActionResult = {};

export function ProductCategoriesDialog({
  open,
  categories,
  onClose,
}: {
  open: boolean;
  categories: ProductCategoryRow[];
  onClose: () => void;
}) {
  const t = useTranslations("pos.products.categories");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(
    createInternalProductCategory,
    initial,
  );
  const [editState, editAction, editPending] = useActionState(
    updateInternalProductCategory,
    initial,
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (createState.ok) router.refresh();
  }, [createState, router]);

  useEffect(() => {
    if (!editState.ok) return;
    setEditingId(null);
    router.refresh();
  }, [editState, router]);

  return (
    <FormDialog open={open} onClose={onClose} title={t("title")} size="md">
      <div className="space-y-5">
        <p className="text-sm text-slate-600">{t("intro")}</p>

        <form action={createAction} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Field label={t("name")} htmlFor="new_product_category_name">
              <Input
                id="new_product_category_name"
                name="name"
                required
                placeholder={t("namePlaceholder")}
              />
            </Field>
          </div>
          <div className="w-24">
            <Field label={t("sortOrder")} htmlFor="new_product_category_sort">
              <Input
                id="new_product_category_sort"
                name="sort_order"
                type="number"
                defaultValue={0}
              />
            </Field>
          </div>
          <Button type="submit" disabled={createPending} className="h-10">
            {createPending ? t("saving") : t("add")}
          </Button>
        </form>
        {createState.error ? <p className="text-sm text-red-600">{createState.error}</p> : null}

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {categories.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">{t("empty")}</p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 py-2">
                {editingId === cat.id ? (
                  <form action={editAction} className="flex w-full flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={cat.id} />
                    <Input
                      name="name"
                      required
                      defaultValue={cat.name}
                      className="h-9 min-w-[10rem] flex-1"
                    />
                    <Input
                      name="sort_order"
                      type="number"
                      defaultValue={cat.sort_order}
                      className="h-9 w-20"
                    />
                    <Button type="submit" disabled={editPending} className="h-9">
                      {tCommon("save")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => setEditingId(null)}
                    >
                      {tCommon("cancel")}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{cat.name}</p>
                      <p className="text-xs text-slate-500">
                        {t("sortLabel", { order: cat.sort_order })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      onClick={() => setEditingId(cat.id)}
                    >
                      {tCommon("edit")}
                    </Button>
                    <form action={deleteInternalProductCategory}>
                      <input type="hidden" name="id" value={cat.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-8 text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          if (!window.confirm(t("deleteConfirm", { name: cat.name }))) {
                            e.preventDefault();
                          }
                        }}
                      >
                        {tCommon("delete")}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        {editState.error ? <p className="text-sm text-red-600">{editState.error}</p> : null}
      </div>
    </FormDialog>
  );
}
