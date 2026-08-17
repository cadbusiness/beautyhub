"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteInternalProduct } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton } from "@/components/ui/row-actions";
import { formatPrice } from "@/lib/utils";
import type { ProductCategoryRow } from "@/lib/institut/internal-products";
import { InternalProductForm, type InternalProductFormValues } from "./internal-product-form";
import { ProductCategoriesDialog } from "./product-categories-dialog";

type ProductRow = InternalProductFormValues;

export function ProductsManager({
  products,
  categories,
  currency = "eur",
}: {
  products: ProductRow[];
  categories: ProductCategoryRow[];
  currency?: string;
}) {
  const t = useTranslations("pos.products");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter === "none" && p.category_id) return false;
      if (categoryFilter !== "all" && categoryFilter !== "none" && p.category_id !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, query, categoryFilter]);

  const emptyMessage = products.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListToolbar
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoriesOpen(true)}
              className="h-9 w-full sm:w-auto"
            >
              {t("manageCategories")}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="h-9 w-full sm:w-auto"
            >
              + {t("new")}
            </Button>
          </div>
        }
      >
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 sm:w-48"
        >
          <option value="all">{t("filterCategoryAll")}</option>
          <option value="none">{t("filterCategoryNone")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.name")}</th>
              <th className={`hidden w-40 sm:table-cell ${dataTableHead}`}>
                {t("columns.category")}
              </th>
              <th className={`hidden w-28 sm:table-cell ${dataTableHead}`}>{t("columns.sku")}</th>
              <th className={`w-24 ${dataTableHead}`}>{t("columns.stock")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.price")}</th>
              <th className={`w-36 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>{p.name}</td>
                <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                  {p.category_id
                    ? (categoryNameById.get(p.category_id) ?? tCommon("dash"))
                    : tCommon("dash")}
                </td>
                <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                  {p.sku ?? tCommon("dash")}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {p.stock_quantity ?? tCommon("dash")}
                </td>
                <td className={`whitespace-nowrap text-right tabular-nums ${dataTableCell}`}>
                  {formatPrice(p.price_cents, currency)}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <div className="flex justify-end gap-1">
                    <RowActionButton
                      type="button"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setEditing(p);
                        setDialogOpen(true);
                      }}
                    >
                      {tCommon("edit")}
                    </RowActionButton>
                    <form action={deleteInternalProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <RowActionButton type="submit" tone="danger" icon={<Trash2 className="h-3.5 w-3.5" />}>
                        {t("delete")}
                      </RowActionButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {filtered.length > 0 ? (
        <ListPanelFooter>
          {t("footer", { count: filtered.length })}
          {query || categoryFilter !== "all"
            ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: products.length })}`
            : ""}
        </ListPanelFooter>
      ) : null}

      {dialogOpen ? (
        <FormDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          title={editing ? t("dialogEditTitle") : t("dialogTitle")}
        >
          <InternalProductForm
            key={editing?.id ?? "new"}
            categories={categories}
            product={editing}
            onSuccess={() => {
              setDialogOpen(false);
              setEditing(null);
            }}
          />
        </FormDialog>
      ) : null}

      {categoriesOpen ? (
        <ProductCategoriesDialog
          open={categoriesOpen}
          categories={categories}
          onClose={() => setCategoriesOpen(false)}
        />
      ) : null}
    </>
  );
}
