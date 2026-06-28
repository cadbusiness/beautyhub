"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("institut.clients");
  const tCommon = useTranslations("common");
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
              + {t("new")}
            </Button>
          }
        >
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable
          empty={
            filtered.length === 0
              ? clients.length === 0
                ? t("empty")
                : t("noResults")
              : undefined
          }
        >
          {filtered.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className={dataTableHead}>{t("columns.name")}</th>
                  <th className={dataTableHead}>{t("columns.email")}</th>
                  <th className={dataTableHead}>{t("columns.phone")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={rowClass}>
                    <td className={`text-slate-900 ${dataTableCell}`}>
                      {c.full_name ?? tCommon("dash")}
                    </td>
                    <td className={`text-slate-600 ${dataTableCell}`}>{c.email}</td>
                    <td className={`text-slate-600 ${dataTableCell}`}>
                      {c.phone ?? tCommon("dash")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter>
            {t("footer", { count: filtered.length })}
            {query
              ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: clients.length })}`
              : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("dialogTitle")}
      >
        <ClientForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
