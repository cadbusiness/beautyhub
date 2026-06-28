"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { paginateItems } from "@/lib/ui/pagination";
import type { BrandListRow } from "@/lib/platform/brands";
import { createBrand, updateBrand, type ActionResult } from "../actions";

const PAGE_SIZE = 12;
const initial: ActionResult = {};

export function BrandsManager({ brands }: { brands: BrandListRow[] }) {
  const t = useTranslations("admin.brands");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BrandListRow | null>(null);
  const [createState, createAction, createPending] = useActionState(createBrand, initial);
  const [editState, editAction, editPending] = useActionState(updateBrand, initial);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
    );
  }, [brands, query]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (createState.ok) setCreateOpen(false);
  }, [createState.ok]);

  useEffect(() => {
    if (editState.ok) setEditing(null);
  }, [editState.ok]);

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setCreateOpen(true)} className="h-9 w-full sm:w-auto">
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

        <DataTable empty={filtered.length === 0 ? t("empty") : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.brand")}</th>
                <th className={dataTableHead}>{t("columns.slug")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.tenants")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.type")}</th>
                <th className={`w-24 ${dataTableHead}`} />
              </tr>
            </thead>
            <tbody>
              {slice.items.map((brand) => (
                <tr key={brand.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    {brand.isPlatform ? (
                      <span className="font-medium text-slate-900">{brand.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing(brand)}
                        className="font-medium text-slate-900 hover:text-slate-600"
                      >
                        {brand.name}
                      </button>
                    )}
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{brand.slug}</td>
                  <td className={dataTableCell}>
                    <Link
                      href={`/admin/tenants?brand=${brand.id}`}
                      className="text-slate-700 hover:underline"
                    >
                      {brand.tenantCount}
                    </Link>
                  </td>
                  <td className={dataTableCell}>
                    {brand.isPlatform ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                        {t("platform")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">{t("reseller")}</span>
                    )}
                  </td>
                  <td className={dataTableCell}>
                    {!brand.isPlatform ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setEditing(brand)}
                      >
                        {t("edit")}
                      </Button>
                    ) : null}
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

      {createOpen ? (
        <FormDialog open onClose={() => setCreateOpen(false)} title={t("dialogTitle")}>
          <form action={createAction} className="space-y-4">
            <Field label={t("form.name")} htmlFor="create_name">
              <Input id="create_name" name="name" required />
            </Field>
            <Field label={t("form.slug")} htmlFor="create_slug">
              <Input id="create_slug" name="slug" placeholder="ma-marque" />
            </Field>
            {createState.error ? <p className="text-sm text-red-600">{createState.error}</p> : null}
            <Button type="submit" disabled={createPending}>
              {createPending ? t("form.submitting") : t("form.create")}
            </Button>
          </form>
        </FormDialog>
      ) : null}

      {editing ? (
        <FormDialog open onClose={() => setEditing(null)} title={editing.name}>
          <form action={editAction} className="space-y-4">
            <input type="hidden" name="brand_id" value={editing.id} />
            <Field label={t("form.name")} htmlFor="edit_name">
              <Input id="edit_name" name="name" defaultValue={editing.name} required />
            </Field>
            <Field label={t("form.slug")} htmlFor="edit_slug">
              <Input id="edit_slug" name="slug" defaultValue={editing.slug} required />
            </Field>
            {editState.error ? <p className="text-sm text-red-600">{editState.error}</p> : null}
            {editState.ok ? <p className="text-sm text-emerald-600">{editState.message}</p> : null}
            <Button type="submit" disabled={editPending}>
              {editPending ? t("form.submitting") : t("form.submit")}
            </Button>
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
