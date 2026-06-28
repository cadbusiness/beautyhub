"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { CreateTenantForm } from "./create-tenant-form";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  planName: string;
  activeModules: number;
}

export function TenantsManager({
  tenants,
  plans,
}: {
  tenants: TenantRow[];
  plans: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  const emptyMessage =
    tenants.length === 0 ? "Aucun institut pour le moment." : "Aucun resultat.";

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + Nouvel institut
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche institut, identifiant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Institut</th>
                <th className={dataTableHead}>Identifiant</th>
                <th className={dataTableHead}>Formule</th>
                <th className={`w-32 ${dataTableHead}`}>Modules actifs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="font-medium text-slate-900 hover:text-violet-700"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{t.slug}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{t.planName}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{t.activeModules}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouvel institut"
        size="lg"
      >
        <CreateTenantForm plans={plans} onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
