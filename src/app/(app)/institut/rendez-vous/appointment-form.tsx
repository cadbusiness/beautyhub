"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createAppointment,
  updateAppointment,
  type ActionResult,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { CalendarAppointment } from "./calendar/types";
import { STATUS_LABELS } from "./calendar/types";

const initial: ActionResult = {};

interface Option {
  id: string;
  label: string;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentForm({
  mode = "create",
  appointment,
  clients,
  services,
  staff,
  resources = [],
  onSuccess,
}: {
  mode?: "create" | "edit";
  appointment?: CalendarAppointment;
  clients: Option[];
  services: Option[];
  staff: Option[];
  resources?: Option[];
  onSuccess?: () => void;
}) {
  const actionFn = mode === "edit" ? updateAppointment : createAppointment;
  const [state, action, pending] = useActionState(actionFn, initial);
  const [ignoreSchedule, setIgnoreSchedule] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (mode === "create") formRef.current?.reset();
      setIgnoreSchedule(false);
      onSuccess?.();
    }
  }, [state.ok, onSuccess, mode]);

  useEffect(() => {
    if (state.warning && !state.ok) {
      setIgnoreSchedule(false);
    }
  }, [state.warning, state.ok]);

  const showScheduleWarning = Boolean(state.warning && !state.ok && !ignoreSchedule);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {mode === "edit" && appointment ? (
        <input type="hidden" name="id" value={appointment.id} />
      ) : null}
      <input type="hidden" name="ignore_schedule" value={ignoreSchedule ? "1" : "0"} />

      <Field label="Client" htmlFor="client_id">
        <Select
          id="client_id"
          name="client_id"
          defaultValue={appointment?.client_id ?? ""}
        >
          <option value="">— Sans client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Prestation" htmlFor="service_id">
        <Select
          id="service_id"
          name="service_id"
          required
          defaultValue={appointment?.service_id ?? ""}
        >
          <option value="" disabled>
            Choisir une prestation
          </option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Employé(e)" htmlFor="staff_id">
        <Select
          id="staff_id"
          name="staff_id"
          defaultValue={appointment?.staff_id ?? ""}
        >
          <option value="">— Indifférent —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      {resources.length > 0 ? (
        <Field label="Cabine" htmlFor="resource_id">
          <Select
            id="resource_id"
            name="resource_id"
            defaultValue={appointment?.resource_id ?? ""}
          >
            <option value="">— Aucune —</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Date et heure de début" htmlFor="starts_at">
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={
            appointment ? toDatetimeLocal(appointment.starts_at) : undefined
          }
        />
      </Field>
      {mode === "edit" ? (
        <Field label="Date et heure de fin" htmlFor="ends_at">
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={
              appointment ? toDatetimeLocal(appointment.ends_at) : undefined
            }
          />
        </Field>
      ) : null}
      {mode === "edit" && appointment ? (
        <Field label="Statut" htmlFor="status">
          <Select id="status" name="status" defaultValue={appointment.status}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          placeholder="Optionnel"
          defaultValue={appointment?.notes ?? ""}
        />
      </Field>

      {showScheduleWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{state.warning}</p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ignoreSchedule}
              onChange={(e) => setIgnoreSchedule(e.target.checked)}
            />
            <span>Confirmer malgré l&apos;horaire hors planning</span>
          </label>
        </div>
      ) : null}

      {state.error && !showScheduleWarning ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : mode === "edit"
            ? "Enregistrer"
            : "Créer le rendez-vous"}
      </Button>
    </form>
  );
}
