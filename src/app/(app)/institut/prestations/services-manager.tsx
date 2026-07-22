"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteService } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination";
import { ServiceThumbnail } from "@/components/institut/service-thumbnail";
import { paginateItems } from "@/lib/ui/pagination";
import { formatPrice } from "@/lib/utils";
import { ServiceDialog, type ServiceRow } from "./service-dialog";

const LIST_PAGE_SIZE = 10;

type Filter = "all" | "active" | "inactive";
type Scope = "catalog" | "extra_only" | "all";

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${className ?? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="m2.695 14.763-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 9.24A2.75 2.75 0 0 0 7.596 17h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-9.24.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ServiceBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "violet" | "slate";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-200/70 text-slate-600",
  };
  return (
    <span
      className={`max-w-[9rem] shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const t = useTranslations("institut.services");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filter === "active" && !s.is_active) return false;
      if (filter === "inactive" && s.is_active) return false;
      if (scope === "catalog" && s.visibility === "extra_only") return false;
      if (scope === "extra_only" && s.visibility !== "extra_only") return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, query, filter, scope]);

  const slice = useMemo(
    () => paginateItems(filtered, page, LIST_PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => {
    setPage(1);
  }, [query, filter, scope]);

  useEffect(() => {
    if (page > slice.totalPages) setPage(slice.totalPages);
  }, [page, slice.totalPages]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function confirmDelete(service: ServiceRow) {
    if (!window.confirm(t("deleteConfirm", { name: service.name }))) return;
    const form = document.getElementById(`delete-service-${service.id}`) as HTMLFormElement | null;
    form?.requestSubmit();
  }

  const createVisibility = scope === "extra_only" ? "extra_only" : "catalog";
  const createLabel = scope === "extra_only" ? t("newExtra") : t("new");
  const emptyMessage =
    services.length === 0
      ? scope === "extra_only"
        ? t("emptyExtras")
        : t("empty")
      : scope === "extra_only"
        ? t("noExtraResults")
        : t("noResults");

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
              + {createLabel}
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
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 sm:w-48"
          >
            <option value="catalog">{t("scopeCatalog")}</option>
            <option value="extra_only">{t("scopeExtras")}</option>
            <option value="all">{t("scopeAll")}</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 sm:w-36"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="active">{t("filterActive")}</option>
            <option value="inactive">{t("filterInactive")}</option>
          </select>
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={`w-12 ${dataTableHeadCompact}`} aria-hidden />
                <th className={dataTableHeadCompact}>{t("columns.title")}</th>
                <th className={`hidden w-24 sm:table-cell ${dataTableHeadCompact}`}>
                  {t("columns.duration")}
                </th>
                <th className={`w-24 text-right ${dataTableHeadCompact}`}>{t("columns.price")}</th>
                <th className={`w-20 text-right ${dataTableHeadCompact}`}>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((s) => (
                <tr key={s.id} className={dataTableRow}>
                  <td className={dataTableCellCompact}>
                    <ServiceThumbnail name={s.name} imageUrl={s.image_url} color={s.color} />
                  </td>
                  <td className={`max-w-0 ${dataTableCellCompact}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="min-w-0 truncate font-medium text-slate-900 hover:text-slate-600"
                      >
                        {s.name}
                      </button>
                      {s.description ? (
                        <ServiceBadge tone="neutral">{s.description}</ServiceBadge>
                      ) : null}
                      {s.visibility === "extra_only" ? (
                        <ServiceBadge tone="violet">{t("extraBadge")}</ServiceBadge>
                      ) : null}
                      {!s.is_active ? (
                        <ServiceBadge tone="slate">{t("hiddenBadge")}</ServiceBadge>
                      ) : null}
                    </div>
                  </td>
                  <td className={`hidden text-slate-600 sm:table-cell ${dataTableCellCompact}`}>
                    {t("durationMin", { min: s.duration_min })}
                  </td>
                  <td
                    className={`whitespace-nowrap text-right tabular-nums text-slate-900 ${dataTableCellCompact}`}
                  >
                    {formatPrice(s.price_cents, s.currency)}
                  </td>
                  <td className={`text-right ${dataTableCellCompact}`}>
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton label={t("edit")} onClick={() => openEdit(s)}>
                        <EditIcon />
                      </IconButton>
                      <form id={`delete-service-${s.id}`} action={deleteService}>
                        <input type="hidden" name="id" value={s.id} />
                        <IconButton
                          label={tCommon("delete")}
                          onClick={() => confirmDelete(s)}
                          className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon />
                        </IconButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </ListPanel>

      <ServiceDialog
        open={dialogOpen}
        service={editing}
        allServices={services}
        createVisibility={createVisibility}
        onClose={closeDialog}
      />
    </>
  );
}
