"use client";

import { Trash2 } from "lucide-react";
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
import { InternalProductForm } from "./internal-product-form";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  stock_quantity: number | null;
};

export function ProductsManager({ products }: { products: ProductRow[] }) {
  const t = useTranslations("pos.products");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false),
    );
  }, [products, query]);

  const emptyMessage = products.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListToolbar
        action={
          <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
            + {t("new")}
          </Button>
        }
      >
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.name")}</th>
              <th className={`hidden w-28 sm:table-cell ${dataTableHead}`}>{t("columns.sku")}</th>
              <th className={`w-24 ${dataTableHead}`}>{t("columns.stock")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.price")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>{p.name}</td>
                <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                  {p.sku ?? tCommon("dash")}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {p.stock_quantity ?? tCommon("dash")}
                </td>
                <td className={`whitespace-nowrap text-right tabular-nums ${dataTableCell}`}>
                  {formatPrice(p.price_cents)}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <form action={deleteInternalProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <RowActionButton type="submit" tone="danger" icon={<Trash2 className="h-3.5 w-3.5" />}>
                      {t("delete")}
                    </RowActionButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {filtered.length > 0 ? (
        <ListPanelFooter>
          {t("footer", { count: filtered.length })}
          {query
            ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: products.length })}`
            : ""}
        </ListPanelFooter>
      ) : null}

      <FormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("dialogTitle")}>
        <InternalProductForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
