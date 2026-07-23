"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Select } from "@/components/ui/input";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton } from "@/components/ui/row-actions";
import type { VoucherTemplateRow } from "@/lib/institut/voucher-pdf";
import { saveGiftProductSettings, type ActionResult } from "./gift-product-actions";

export type GiftProductRow = {
  id: string;
  name: string;
  woo_id: number | null;
  is_gift_card: boolean;
  gift_template_id: string | null;
  gift_variation_templates: Record<string, string>;
};

type VariationRow = { id: number; name: string; sku: string };

const initial: ActionResult = {};

export function GiftProductsManager({
  products,
  templates,
}: {
  products: GiftProductRow[];
  templates: VoucherTemplateRow[];
}) {
  const t = useTranslations("pos.vouchers.giftProducts");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState<GiftProductRow | null>(null);

  return (
    <div className="border-b border-slate-200 pb-6">
      <ListToolbar>
        <p className="text-sm text-slate-600">{t("description")}</p>
      </ListToolbar>

      <DataTable empty={products.length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.product")}</th>
              <th className={dataTableHead}>{t("columns.gift")}</th>
              <th className={`hidden sm:table-cell ${dataTableHead}`}>{t("columns.template")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => {
              const tpl = templates.find((x) => x.id === row.gift_template_id);
              return (
                <tr key={row.id} className={dataTableRow}>
                  <td className={`font-medium text-slate-900 ${dataTableCell}`}>{row.name}</td>
                  <td className={dataTableCell}>
                    {row.is_gift_card ? t("yes") : t("no")}
                  </td>
                  <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                    {tpl?.name ?? t("defaultTemplate")}
                  </td>
                  <td className={`text-right ${dataTableCell}`}>
                    <RowActionButton type="button" onClick={() => setEditing(row)}>
                      {tCommon("edit")}
                    </RowActionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>

      {editing ? (
        <GiftProductDialog
          open
          product={editing}
          templates={templates}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function GiftProductDialog({
  open,
  product,
  templates,
  onClose,
}: {
  open: boolean;
  product: GiftProductRow;
  templates: VoucherTemplateRow[];
  onClose: () => void;
}) {
  const t = useTranslations("pos.vouchers.giftProducts");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveGiftProductSettings, initial);
  const [isGift, setIsGift] = useState(product.is_gift_card);
  const [templateId, setTemplateId] = useState(product.gift_template_id ?? "");
  const [variations, setVariations] = useState<VariationRow[]>([]);
  const [variationMap, setVariationMap] = useState<Record<string, string>>(
    product.gift_variation_templates ?? {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    if (!product.woo_id) return;
    let cancelled = false;
    void fetch(`/api/institut/woo-products/${product.woo_id}/variations`)
      .then((r) => (r.ok ? r.json() : { variations: [] }))
      .then((data: { variations?: VariationRow[] }) => {
        if (!cancelled) setVariations(data.variations ?? []);
      })
      .catch(() => {
        if (!cancelled) setVariations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product.woo_id]);

  return (
    <FormDialog open={open} onClose={onClose} title={t("dialogTitle")} size="lg">
      <form action={action} className="space-y-4">
        <input type="hidden" name="product_id" value={product.id} />
        <input type="hidden" name="gift_variation_templates" value={JSON.stringify(variationMap)} />
        <p className="text-sm font-medium text-slate-900">{product.name}</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_gift_card"
            value="1"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
          />
          {t("markGift")}
        </label>
        <Field label={t("template")} htmlFor="gift_template_id">
          <Select
            id="gift_template_id"
            name="gift_template_id"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">{t("defaultTemplate")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </Select>
        </Field>
        {variations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("variations")}</p>
            {variations.map((v) => (
              <Field key={v.id} label={v.name || `#${v.id}`} htmlFor={`var-${v.id}`}>
                <Select
                  id={`var-${v.id}`}
                  value={variationMap[String(v.id)] ?? ""}
                  onChange={(e) =>
                    setVariationMap((prev) => {
                      const next = { ...prev };
                      if (e.target.value) next[String(v.id)] = e.target.value;
                      else delete next[String(v.id)];
                      return next;
                    })
                  }
                >
                  <option value="">{t("inheritTemplate")}</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        ) : null}
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
