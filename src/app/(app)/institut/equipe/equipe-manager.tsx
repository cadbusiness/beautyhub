"use client";

import { useMemo, useState } from "react";
import { deleteStaffMember, deleteResource } from "../actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { SectionTitle } from "@/components/ui/section-title";
import { StaffForm } from "./staff-form";
import { ResourceForm } from "./resource-form";

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  color: string | null;
};

type ResourceRow = {
  id: string;
  name: string;
};

export function EquipeManager({
  staff,
  resources,
}: {
  staff: StaffRow[];
  resources: ResourceRow[];
}) {
  const [staffQuery, setStaffQuery] = useState("");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false),
    );
  }, [staff, staffQuery]);

  return (
    <>
      <section className="space-y-4">
        <SectionTitle>Personnel</SectionTitle>
        <ListToolbar
          action={
            <Button
              onClick={() => setStaffDialogOpen(true)}
              className="h-9 w-full sm:w-auto"
            >
              + Ajouter du personnel
            </Button>
          }
        >
          <input
            type="search"
            placeholder="Recherche personnel..."
            value={staffQuery}
            onChange={(e) => setStaffQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:max-w-xs"
          />
        </ListToolbar>

        <DataTable
          empty={
            staff.length === 0
              ? "Aucun membre du personnel."
              : filteredStaff.length === 0
                ? "Aucun resultat."
                : undefined
          }
        >
          {filteredStaff.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className={`w-10 ${dataTableHead}`} aria-label="Couleur" />
                  <th className={dataTableHead}>Nom</th>
                  <th className={dataTableHead}>Email</th>
                  <th className={`w-28 text-right ${dataTableHead}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className={dataTableCell}>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color ?? "#64748b" }}
                      />
                    </td>
                    <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                      {s.full_name}
                    </td>
                    <td className={`text-slate-600 ${dataTableCell}`}>{s.email ?? "—"}</td>
                    <td className={`text-right ${dataTableCell}`}>
                      <form action={deleteStaffMember}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button variant="ghost" type="submit" className="h-8 text-red-600">
                          Supprimer
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataTable>
      </section>

      <section className="space-y-4">
        <SectionTitle>Cabines / ressources</SectionTitle>
        <ListToolbar
          action={
            <Button
              onClick={() => setResourceDialogOpen(true)}
              className="h-9 w-full sm:w-auto"
            >
              + Ajouter une cabine
            </Button>
          }
        >
          <span className="text-sm text-slate-500">
            {resources.length} ressource{resources.length > 1 ? "s" : ""}
          </span>
        </ListToolbar>

        <DataTable empty={resources.length === 0 ? "Aucune cabine configuree." : undefined}>
          {resources.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className={dataTableHead}>Nom</th>
                  <th className={`w-28 text-right ${dataTableHead}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className={`font-medium text-slate-900 ${dataTableCell}`}>{r.name}</td>
                    <td className={`text-right ${dataTableCell}`}>
                      <form action={deleteResource}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button variant="ghost" type="submit" className="h-8 text-red-600">
                          Supprimer
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </DataTable>
      </section>

      <FormDialog
        open={staffDialogOpen}
        onClose={() => setStaffDialogOpen(false)}
        title="Ajouter du personnel"
      >
        <StaffForm onSuccess={() => setStaffDialogOpen(false)} />
      </FormDialog>

      <FormDialog
        open={resourceDialogOpen}
        onClose={() => setResourceDialogOpen(false)}
        title="Ajouter une cabine"
      >
        <ResourceForm onSuccess={() => setResourceDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
