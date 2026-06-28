"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteService } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";
import { ServiceDialog, type ServiceRow } from "./service-dialog";

type Filter = "all" | "active" | "inactive";

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const t = useTranslations("institut.services");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filter === "active" && !s.is_active) return false;
      if (filter === "inactive" && s.is_active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, query, filter]);

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

  const emptyMessage = services.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListPanel>
        <ListToolbar
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
                <th className={`w-10 ${dataTableHead}`} aria-label={t("columns.status")} />
                <th className={dataTableHead}>{t("columns.title")}</th>
                <th className={`hidden w-28 sm:table-cell ${dataTableHead}`}>
                  {t("columns.duration")}
                </th>
                <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.price")}</th>
                <th className={`w-32 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color ?? "#64748b" }}
                      title={s.is_active ? t("visible") : t("hidden")}
                    />
                  </td>
                  <td className={`max-w-0 ${dataTableCell}`}>
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="group w-full text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-slate-900 group-hover:text-slate-600">
                          {s.name}
                        </span>
                        {!s.is_active ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            {t("hiddenBadge")}
                          </span>
                        ) : null}
                      </span>
                      {s.description ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {s.description}
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                    {t("durationMin", { min: s.duration_min })}
                  </td>
                  <td
                    className={`whitespace-nowrap text-right tabular-nums text-slate-900 ${dataTableCell}`}
                  >
                    {formatPrice(s.price_cents, s.currency)}
                  </td>
                  <td className={`text-right ${dataTableCell}`}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => openEdit(s)}
                      >
                        {t("edit")}
                      </Button>
                      <form action={deleteService}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button
                          variant="ghost"
                          type="submit"
                          className="h-8 px-2 text-xs text-red-600"
                        >
                          {t("deleteShort")}
                        </Button>
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
            {filter !== "all" || query
              ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: services.length })}`
              : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <ServiceDialog open={dialogOpen} service={editing} onClose={closeDialog} />
    </>
  );
}
