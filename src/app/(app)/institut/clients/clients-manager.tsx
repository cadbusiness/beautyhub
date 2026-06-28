"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { ClientForm } from "./client-form";

type ClientRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
};

const rowClass = dataTableRow;

export function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.full_name?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, query]);

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + Nouveau client
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche nom, email, telephone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable
          empty={
            filtered.length === 0
              ? clients.length === 0
                ? "Aucun client pour le moment."
                : "Aucun resultat pour cette recherche."
              : undefined
          }
        >
          {filtered.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={dataTableHead}>Nom</th>
                  <th className={dataTableHead}>Email</th>
                  <th className={dataTableHead}>Telephone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={rowClass}>
                    <td className={`text-slate-900 ${dataTableCell}`}>
                      {c.full_name ?? "-"}
                    </td>
                    <td className={`text-slate-600 ${dataTableCell}`}>{c.email}</td>
                    <td className={`text-slate-600 ${dataTableCell}`}>
                      {c.phone ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter>
            {filtered.length} client{filtered.length > 1 ? "s" : ""}
            {query ? ` sur ${clients.length}` : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouveau client"
      >
        <ClientForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
