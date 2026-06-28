"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { paginateItems } from "@/lib/ui/pagination";
import type { ModuleCatalogRow } from "@/lib/platform/modules";
import { toggleModuleActive, updateModuleCatalog, type ActionResult } from "../actions";

const PAGE_SIZE = 12;
const initial: ActionResult = {};

export function ModulesManager({ modules }: { modules: ModuleCatalogRow[] }) {
  const t = useTranslations("admin.modules");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ModuleCatalogRow | null>(null);
  const [state, formAction, pending] = useActionState(updateModuleCatalog, initial);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.category?.toLowerCase().includes(q) ?? false),
    );
  }, [modules, query]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <>
      <ListPanel>
        <ListToolbar>
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? t("empty") : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.module")}</th>
                <th className={dataTableHead}>{t("columns.category")}</th>
                <th className={`w-24 ${dataTableHead}`}>{t("columns.version")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.tenants")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
                <th className={`w-36 ${dataTableHead}`} />
              </tr>
            </thead>
            <tbody>
              {slice.items.map((mod) => (
                <tr key={mod.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <button
                      type="button"
                      onClick={() => setEditing(mod)}
                      className="text-left font-medium text-slate-900 hover:text-slate-600"
                    >
                      {mod.name}
                    </button>
                    <p className="text-xs text-slate-500">{mod.id}</p>
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{mod.category ?? "—"}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{mod.version}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{mod.tenantCount}</td>
                  <td className={dataTableCell}>
                    <span
                      className={
                        mod.isActive
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      }
                    >
                      {mod.isActive ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className={dataTableCell}>
                    <form action={toggleModuleActive}>
                      <input type="hidden" name="module_id" value={mod.id} />
                      <input type="hidden" name="is_active" value={(!mod.isActive).toString()} />
                      <Button type="submit" variant="outline" className="h-8 text-xs">
                        {mod.isActive ? t("disable") : t("enable")}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter
            pagination={{
              page: slice.page,
              totalPages: slice.totalPages,
              onPageChange: setPage,
            }}
          >
            {t("footerCount", { count: slice.total })}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      {editing ? (
        <FormDialog open onClose={() => setEditing(null)} title={editing.name}>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="module_id" value={editing.id} />
            <Field label={t("form.name")} htmlFor="name">
              <Input id="name" name="name" defaultValue={editing.name} required />
            </Field>
            <Field label={t("form.description")} htmlFor="description">
              <Input id="description" name="description" defaultValue={editing.description ?? ""} />
            </Field>
            <Field label={t("form.category")} htmlFor="category">
              <Input id="category" name="category" defaultValue={editing.category ?? ""} />
            </Field>
            <Field label={t("form.version")} htmlFor="version">
              <Input id="version" name="version" defaultValue={editing.version} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editing.isActive}
                className="rounded border-slate-300"
              />
              {t("form.isActive")}
            </label>
            {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
            {state.ok ? <p className="text-sm text-emerald-600">{state.message}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? t("form.submitting") : t("form.submit")}
            </Button>
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
