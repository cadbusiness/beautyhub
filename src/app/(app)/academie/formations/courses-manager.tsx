"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteCourse } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";
import { CourseForm } from "./course-form";

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  is_published: boolean;
};

export function CoursesManager({ courses }: { courses: CourseRow[] }) {
  const t = useTranslations("academie.courses");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    );
  }, [courses, query]);

  const emptyMessage = courses.length === 0 ? t("empty") : t("noResults");

  return (
    <>
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
          className="h-9 sm:max-w-xs"
        />
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.title")}</th>
              <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.price")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={dataTableRow}>
                <td className={`max-w-0 ${dataTableCell}`}>
                  <p className="truncate font-medium text-slate-900">{c.title}</p>
                  {c.description ? (
                    <p className="truncate text-xs text-slate-400">{c.description}</p>
                  ) : null}
                </td>
                <td className={dataTableCell}>
                  {c.is_published ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      {t("published")}
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {t("draft")}
                    </span>
                  )}
                </td>
                <td className={`whitespace-nowrap text-right tabular-nums ${dataTableCell}`}>
                  {formatPrice(c.price_cents, c.currency)}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <form action={deleteCourse}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button variant="ghost" type="submit" className="h-8 text-red-600">
                      {t("delete")}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {filtered.length > 0 ? (
        <ListPanelFooter>
          {t("footer", { count: filtered.length })}
          {query ? ` ${tCommon("countOfTotal", { count: filtered.length, total: courses.length })}` : ""}
        </ListPanelFooter>
      ) : null}

      <FormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("dialogTitle")}>
        <CourseForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
