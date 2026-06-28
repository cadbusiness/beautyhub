"use client";

import { useMemo, useState } from "react";
import { deleteCourse } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
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

  const emptyMessage =
    courses.length === 0
      ? "Aucune formation pour le moment."
      : "Aucun resultat pour cette recherche.";

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + Nouvelle formation
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche par titre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-xs"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>Titre</th>
                <th className={`w-28 ${dataTableHead}`}>Statut</th>
                <th className={`w-28 text-right ${dataTableHead}`}>Prix</th>
                <th className={`w-28 text-right ${dataTableHead}`}>Actions</th>
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
                        Publiee
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Brouillon
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
                        Supprimer
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
            {filtered.length} formation{filtered.length > 1 ? "s" : ""}
            {query ? ` sur ${courses.length}` : ""}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouvelle formation"
      >
        <CourseForm onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
