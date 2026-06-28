"use client";

import { useMemo, useState } from "react";
import { setAppointmentStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { AppointmentForm } from "./appointment-form";

const STATUS: Record<string, string> = {
  booked: "Reserve",
  confirmed: "Confirme",
  completed: "Termine",
  cancelled: "Annule",
  no_show: "Absent",
};

type Option = { id: string; label: string };

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
  price_cents: number;
  serviceName: string;
  clientName: string;
  staffName: string;
};

export function AppointmentsList({
  appointments,
  clients,
  services,
  staff,
  resources,
}: {
  appointments: AppointmentRow[];
  clients: Option[];
  services: Option[];
  staff: Option[];
  resources: Option[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(
      (a) =>
        a.serviceName.toLowerCase().includes(q) ||
        a.clientName.toLowerCase().includes(q) ||
        a.staffName.toLowerCase().includes(q),
    );
  }, [appointments, query]);

  const emptyMessage =
    appointments.length === 0
      ? "Aucun rendez-vous."
      : "Aucun resultat pour cette recherche.";

  return (
    <>
      <div className="space-y-4">
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + Nouveau rendez-vous
            </Button>
          }
        >
          <Input
            type="search"
            placeholder="Recherche prestation, client, praticien..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className={dataTableHead}>Date</th>
                <th className={dataTableHead}>Prestation</th>
                <th className={`hidden md:table-cell ${dataTableHead}`}>Client</th>
                <th className={`hidden lg:table-cell ${dataTableHead}`}>Praticien</th>
                <th className={`w-28 ${dataTableHead}`}>Statut</th>
                <th className={`w-36 text-right ${dataTableHead}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className={`whitespace-nowrap text-slate-900 ${dataTableCell}`}>
                    {formatDateTime(a.starts_at)}
                  </td>
                  <td className={dataTableCell}>
                    <p className="font-medium text-slate-900">{a.serviceName}</p>
                    <p className="text-xs text-slate-500">{formatPrice(a.price_cents)}</p>
                  </td>
                  <td className={`hidden text-slate-600 md:table-cell ${dataTableCell}`}>
                    {a.clientName}
                  </td>
                  <td className={`hidden text-slate-600 lg:table-cell ${dataTableCell}`}>
                    {a.staffName}
                  </td>
                  <td className={dataTableCell}>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {STATUS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className={`text-right ${dataTableCell}`}>
                    <form action={setAppointmentStatus} className="inline-flex items-center gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <Select name="status" defaultValue={a.status} className="h-8 max-w-32 text-xs">
                        {Object.entries(STATUS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                      <Button variant="outline" type="submit" className="h-8 px-2 text-xs">
                        OK
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouveau rendez-vous"
        size="lg"
      >
        <AppointmentForm
          clients={clients}
          services={services}
          staff={staff}
          resources={resources}
          onSuccess={() => setDialogOpen(false)}
        />
      </FormDialog>
    </>
  );
}
