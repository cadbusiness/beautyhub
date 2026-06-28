"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { setAppointmentStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { AppointmentForm } from "./appointment-form";

const STATUS_KEYS = [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

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
  const t = useTranslations("appointments.list");
  const tStatus = useTranslations("appointments.status");
  const format = useFormatter();
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
    appointments.length === 0 ? t("empty") : t("noResults");

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
          className="h-9 sm:max-w-sm"
        />
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.date")}</th>
              <th className={dataTableHead}>{t("columns.service")}</th>
              <th className={`hidden md:table-cell ${dataTableHead}`}>{t("columns.client")}</th>
              <th className={`hidden lg:table-cell ${dataTableHead}`}>{t("columns.staff")}</th>
              <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
              <th className={`w-36 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className={dataTableRow}>
                <td className={`whitespace-nowrap text-slate-900 ${dataTableCell}`}>
                  {format.dateTime(new Date(a.starts_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className={dataTableCell}>
                  <p className="font-medium text-slate-900">{a.serviceName}</p>
                  <p className="text-xs text-slate-500">
                    {format.number(a.price_cents / 100, {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </td>
                <td className={`hidden text-slate-600 md:table-cell ${dataTableCell}`}>
                  {a.clientName}
                </td>
                <td className={`hidden text-slate-600 lg:table-cell ${dataTableCell}`}>
                  {a.staffName}
                </td>
                <td className={dataTableCell}>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {STATUS_KEYS.includes(a.status as (typeof STATUS_KEYS)[number])
                      ? tStatus(a.status as (typeof STATUS_KEYS)[number])
                      : a.status}
                  </span>
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <form action={setAppointmentStatus} className="inline-flex items-center gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <Select name="status" defaultValue={a.status} className="h-8 max-w-32 text-xs">
                      {STATUS_KEYS.map((value) => (
                        <option key={value} value={value}>
                          {tStatus(value)}
                        </option>
                      ))}
                    </Select>
                    <Button variant="outline" type="submit" className="h-8 px-2 text-xs">
                      {t("confirmStatus")}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("dialogTitle")}
        size="lg"
      >
        {dialogOpen ? (
          <AppointmentForm
            clients={clients}
            services={services}
            staff={staff}
            resources={resources}
            onSuccess={() => setDialogOpen(false)}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
