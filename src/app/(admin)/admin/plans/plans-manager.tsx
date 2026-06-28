"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";
import { PlanForm } from "./plan-form";

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  interval: string;
  modules: string[];
  is_active: boolean;
};

export function PlansManager({
  plans,
  modules,
}: {
  plans: PlanRow[];
  modules: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, query]);

  const emptyMessage = plans.length === 0 ? "Aucune formule." : "Aucun resultat.";

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + Nouvelle formule
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche formule..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-xs"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Formule</th>
                <th className={`w-32 ${dataTableHead}`}>Prix</th>
                <th className={dataTableHead}>Modules</th>
                <th className={`w-28 ${dataTableHead}`}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <Link
                      href={`/admin/plans/${p.id}`}
                      className="font-medium text-slate-900 hover:text-slate-600"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>
                    {formatPrice(p.price_cents)}/{p.interval === "year" ? "an" : "mois"}
                  </td>
                  <td className={`max-w-0 truncate text-slate-500 ${dataTableCell}`}>
                    {p.modules.join(", ") || "—"}
                  </td>
                  <td className={dataTableCell}>
                    <span
                      className={
                        p.is_active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      }
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouvelle formule"
        size="lg"
      >
        <PlanForm modules={modules} onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
