"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { EnrollmentForm } from "./enrollment-form";

const STATUS_LABELS: Record<string, string> = {
  enrolled: "Inscrit",
  completed: "Termine",
  cancelled: "Annule",
};

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

  const emptyMessage =
    enrollments.length === 0
      ? "Aucune inscription pour le moment."
      : "Aucun resultat pour cette recherche.";

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button
              onClick={() => setDialogOpen(true)}
              className="h-9 w-full sm:w-auto"
              disabled={courses.length === 0}
            >
              + Nouvelle inscription
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche eleve, email, formation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Eleve</th>
                <th className={dataTableHead}>Formation</th>
                <th className={`w-28 ${dataTableHead}`}>Statut</th>
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
                    {e.acad_courses?.title ?? "-"}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>
                    {STATUS_LABELS[e.status] ?? e.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter>
            {filtered.length} inscription{filtered.length > 1 ? "s" : ""}
            {query ? ` sur ${enrollments.length}` : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouvelle inscription"
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
