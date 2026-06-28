"use client";

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
  return (
    <FormDialog
      open={open && Boolean(appointment)}
      onClose={onClose}
      title="Modifier le rendez-vous"
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
