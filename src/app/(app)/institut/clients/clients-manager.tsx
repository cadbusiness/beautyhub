"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { ClientListSummary, ClientsListFilter, ClientsListPage } from "@/lib/institut/clients";
import { formatPrice } from "@/lib/utils";
import { ClientForm } from "./client-form";
import { ClientsImportDialog } from "./clients-import-dialog";

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

export function ClientsManager({ initial }: { initial: ClientsListPage }) {
  const t = useTranslations("institut.clients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClientsListFilter>("all");
  const [page, setPage] = useState(initial.page);
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ClientListSummary | null>(null);
  const skipInitialFetch = useRef(true);

  useEffect(() => {
    setItems(initial.items);
    setTotal(initial.total);
    setTotalPages(initial.totalPages);
    setPage(initial.page);
  }, [initial]);

  const loadPage = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        filter,
        q: query.trim(),
      });
      const res = await fetch(`/api/institut/clients?${params.toString()}`, { signal });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as ClientsListPage;
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[clients-manager]", error);
    } finally {
      setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => {
    if (
      skipInitialFetch.current &&
      page === initial.page &&
      filter === "all" &&
      !query.trim()
    ) {
      skipInitialFetch.current = false;
      return;
    }
    skipInitialFetch.current = false;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadPage(controller.signal);
    }, query.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filter, page, query, loadPage, initial.page]);

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
    router.refresh();
  }

  const emptyMessage = total === 0 && !query && filter === "all" ? t("empty") : t("noResults");

  return (
    <>
      <ListPanel>
        <ListToolbar
          trailing={
            totalPages > 1 ? (
              <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : undefined
          }
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="h-9 w-full sm:w-auto"
              >
                {t("importCsv")}
              </Button>
              <Button onClick={openCreate} className="h-9 w-full sm:w-auto">
                + {t("new")}
              </Button>
            </div>
          }
        >
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="h-9 sm:max-w-xs"
          />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as ClientsListFilter);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 sm:w-44"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="upcoming">{t("filterUpcoming")}</option>
            <option value="withAccount">{t("filterWithAccount")}</option>
            <option value="withPurchases">{t("filterWithPurchases")}</option>
            <option value="ecommerce">{t("filterEcommerce")}</option>
            <option value="imported">{t("filterImported")}</option>
          </select>
        </ListToolbar>

        <DataTable empty={!loading && items.length === 0 ? emptyMessage : undefined}>
          <table className={`w-full text-sm ${loading ? "opacity-60" : ""}`}>
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
              {items.map((c) => (
                <tr
                  key={c.id}
                  className={`${dataTableRow} cursor-pointer`}
                  onMouseEnter={() => router.prefetch(`/institut/clients/${c.id}`)}
                  onClick={() => router.push(`/institut/clients/${c.id}`)}
                >
                  <td className={`text-slate-900 ${dataTableCellCompact}`}>
                    <Link
                      href={`/institut/clients/${c.id}`}
                      prefetch
                      className="flex min-w-0 flex-col gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                    </Link>
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

        {total > 0 ? (
          <ListPanelFooter>
            {t("footer", { count: total })}
            {query || filter !== "all"
              ? ` · ${tCommon("countOfTotal", { count: items.length, total })}`
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

      {importOpen ? (
        <ClientsImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      ) : null}
    </>
  );
}
