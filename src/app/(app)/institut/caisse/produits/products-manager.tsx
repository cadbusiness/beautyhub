"use client";

import { useMemo, useState } from "react";
import { deleteInternalProduct } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
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

  const emptyMessage =
    products.length === 0
      ? "Aucun produit interne."
      : "Aucun resultat pour cette recherche.";

  return (
    <>
      <ListToolbar
        action={
          <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
            + Nouveau produit
          </Button>
        }
      >
          <Input
            type="search"
            placeholder="Recherche nom, SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-xs"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Nom</th>
                <th className={`hidden w-28 sm:table-cell ${dataTableHead}`}>SKU</th>
                <th className={`w-24 ${dataTableHead}`}>Stock</th>
                <th className={`w-28 text-right ${dataTableHead}`}>Prix</th>
                <th className={`w-28 text-right ${dataTableHead}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={dataTableRow}>
                  <td className={`font-medium text-slate-900 ${dataTableCell}`}>{p.name}</td>
                  <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                    {p.sku ?? "—"}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>
                    {p.stock_quantity ?? "—"}
                  </td>
                  <td className={`whitespace-nowrap text-right tabular-nums ${dataTableCell}`}>
                    {formatPrice(p.price_cents)}
                  </td>
                  <td className={`text-right ${dataTableCell}`}>
                    <form action={deleteInternalProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button variant="ghost" type="submit" className="h-8 text-red-600">
                        Supprimer
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter>
            {filtered.length} produit{filtered.length > 1 ? "s" : ""}
            {query ? ` sur ${products.length}` : ""}
          </ListPanelFooter>
        ) : null}

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouveau produit"
      >
        <InternalProductForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
