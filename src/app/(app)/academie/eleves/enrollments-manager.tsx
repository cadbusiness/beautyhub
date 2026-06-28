"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { EnrollmentForm } from "./enrollment-form";

const STATUS_KEYS = ["enrolled", "completed", "cancelled"] as const;

type EnrollmentRow = {
  id: string;
  student_name: string;
  student_email: string;
  status: string;
  acad_courses: { title: string } | null;
};

type CourseOption = { id: string; title: string };
type ClientOption = { id: string; full_name: string | null; email: string };

export function EnrollmentsManager({
  enrollments,
  courses,
  clients,
}: {
  enrollments: EnrollmentRow[];
  courses: CourseOption[];
  clients: ClientOption[];
}) {
  const t = useTranslations("academie.students");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter(
      (e) =>
        e.student_name.toLowerCase().includes(q) ||
        e.student_email.toLowerCase().includes(q) ||
        (e.acad_courses?.title.toLowerCase().includes(q) ?? false),
    );
  }, [enrollments, query]);

  const emptyMessage = enrollments.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListToolbar
        action={
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-9 w-full sm:w-auto"
            disabled={courses.length === 0}
          >
            + {t("newEnrollment")}
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

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.student")}</th>
              <th className={dataTableHead}>{t("columns.course")}</th>
              <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className={dataTableRow}>
                <td className={dataTableCell}>
                  <p className="text-slate-900">{e.student_name}</p>
                  <p className="text-xs text-slate-500">{e.student_email}</p>
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {e.acad_courses?.title ?? tCommon("dash")}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {STATUS_KEYS.includes(e.status as (typeof STATUS_KEYS)[number])
                    ? t(`status.${e.status as (typeof STATUS_KEYS)[number]}`)
                    : e.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {filtered.length > 0 ? (
        <ListPanelFooter>
          {t("footer", { count: filtered.length })}
          {query
            ? ` ${tCommon("countOfTotal", { count: filtered.length, total: enrollments.length })}`
            : ""}
        </ListPanelFooter>
      ) : null}

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("dialogTitle")}
      >
        <EnrollmentForm
          courses={courses}
          clients={clients}
          onSuccess={() => setDialogOpen(false)}
        />
      </FormDialog>
    </>
  );
}
