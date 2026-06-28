"use client";

import { useTranslations } from "next-intl";
import { FormDialog } from "@/components/ui/form-dialog";
import { AppointmentForm } from "../appointment-form";
import type { CalendarAppointment, CalendarOption } from "./types";

export function AppointmentEditDialog({
  open,
  appointment,
  clients,
  services,
  staff,
  resources,
  onClose,
  onSaved,
}: {
  open: boolean;
  appointment: CalendarAppointment | null;
  clients: CalendarOption[];
  services: CalendarOption[];
  staff: CalendarOption[];
  resources: CalendarOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("appointments.calendar");

  return (
    <FormDialog
      open={open && Boolean(appointment)}
      onClose={onClose}
      title={t("editTitle")}
      size="lg"
    >
      {appointment ? (
        <AppointmentForm
          mode="edit"
          appointment={appointment}
          clients={clients}
          services={services}
          staff={staff}
          resources={resources}
          onSuccess={onSaved}
        />
      ) : null}
    </FormDialog>
  );
}
