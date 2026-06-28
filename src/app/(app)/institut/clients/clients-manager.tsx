"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination";
import type { ClientListSummary } from "@/lib/institut/clients";
import { paginateItems } from "@/lib/ui/pagination";
import { formatPrice } from "@/lib/utils";
import { ClientForm } from "./client-form";

const LIST_PAGE_SIZE = 12;

type Filter = "all" | "upcoming" | "withAccount" | "ecommerce" | "withPurchases";

function ClientTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
      {children}
    </span>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="m2.695 14.763-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
    </svg>
  );
}

export function ClientsManager({ clients }: { clients: ClientListSummary[] }) {
  const t = useTranslations("institut.clients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientListSummary | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter === "upcoming" && c.upcoming_count === 0) return false;
      if (filter === "withAccount" && !c.has_portal_account) return false;
      if (filter === "ecommerce" && !c.has_ecommerce) return false;
      if (filter === "withPurchases" && c.total_spent_cents === 0) return false;
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) ||
        (c.full_name?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        c.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [clients, query, filter]);

  const slice = useMemo(
    () => paginateItems(filtered, page, LIST_PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  useEffect(() => {
    if (page > slice.totalPages) setPage(slice.totalPages);
  }, [page, slice.totalPages]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: ClientListSummary, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(client);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const emptyMessage = clients.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListPanel>
        <ListToolbar
          trailing={
            slice.totalPages > 1 ? (
              <PaginationControls
                page={slice.page}
                totalPages={slice.totalPages}
                onPageChange={setPage}
              />
            ) : undefined
          }
          action={
            <Button onClick={openCreate} className="h-9 w-full sm:w-auto">
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
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 sm:w-44"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="upcoming">{t("filterUpcoming")}</option>
            <option value="withAccount">{t("filterWithAccount")}</option>
            <option value="withPurchases">{t("filterWithPurchases")}</option>
            <option value="ecommerce">{t("filterEcommerce")}</option>
          </select>
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHeadCompact}>{t("columns.name")}</th>
                <th className={`hidden md:table-cell ${dataTableHeadCompact}`}>
                  {t("columns.email")}
                </th>
                <th className={`hidden lg:table-cell ${dataTableHeadCompact}`}>
                  {t("columns.phone")}
                </th>
                <th className={`hidden sm:table-cell w-20 ${dataTableHeadCompact}`}>
                  {t("columns.appointments")}
                </th>
                <th className={`w-24 text-right ${dataTableHeadCompact}`}>
                  {t("columns.spent")}
                </th>
                <th className={`w-12 ${dataTableHeadCompact}`} aria-hidden />
              </tr>
            </thead>
            <tbody>
              {slice.items.map((c) => (
                <tr
                  key={c.id}
                  className={`${dataTableRow} cursor-pointer`}
                  onClick={() => router.push(`/institut/clients/${c.id}`)}
                >
                  <td className={`text-slate-900 ${dataTableCellCompact}`}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {c.full_name ?? tCommon("dash")}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {c.upcoming_count > 0 ? (
                          <ClientTag>{t("badgeUpcoming", { count: c.upcoming_count })}</ClientTag>
                        ) : null}
                        {c.has_portal_account ? (
                          <ClientTag>{t("badgeAccount")}</ClientTag>
                        ) : null}
                        {c.has_ecommerce ? (
                          <ClientTag>{t("badgeEcommerce")}</ClientTag>
                        ) : null}
                        {c.tags.slice(0, 2).map((tag) => (
                          <ClientTag key={tag}>{tag}</ClientTag>
                        ))}
                      </div>
                      <span className="truncate text-xs text-slate-500 md:hidden">{c.email}</span>
                    </div>
                  </td>
                  <td className={`hidden text-slate-600 md:table-cell ${dataTableCellCompact}`}>
                    {c.email}
                  </td>
                  <td className={`hidden text-slate-600 lg:table-cell ${dataTableCellCompact}`}>
                    {c.phone ?? tCommon("dash")}
                  </td>
                  <td
                    className={`hidden tabular-nums text-slate-600 sm:table-cell ${dataTableCellCompact}`}
                  >
                    {c.appointment_count}
                  </td>
                  <td
                    className={`text-right tabular-nums text-slate-900 ${dataTableCellCompact}`}
                  >
                    {c.total_spent_cents > 0
                      ? formatPrice(c.total_spent_cents)
                      : tCommon("dash")}
                  </td>
                  <td className={dataTableCellCompact}>
                    <button
                      type="button"
                      onClick={(e) => openEdit(c, e)}
                      aria-label={t("editClient")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <EditIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter>
            {t("footer", { count: filtered.length })}
            {query || filter !== "all"
              ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: clients.length })}`
              : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? t("dialogEditTitle") : t("dialogTitle")}
        size={editing ? "lg" : "md"}
      >
        <ClientForm client={editing} onSuccess={closeDialog} />
      </FormDialog>
    </>
  );
}
