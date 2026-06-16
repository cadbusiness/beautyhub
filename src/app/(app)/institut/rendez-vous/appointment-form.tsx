"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAppointment, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

interface Option {
  id: string;
  label: string;
}

export function AppointmentForm({
  clients,
  services,
  staff,
}: {
  clients: Option[];
  services: Option[];
  staff: Option[];
}) {
  const [state, action, pending] = useActionState(createAppointment, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Client" htmlFor="client_id">
        <Select id="client_id" name="client_id" defaultValue="">
          <option value="">— Sans client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Prestation" htmlFor="service_id">
        <Select id="service_id" name="service_id" required defaultValue="">
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
      <Field label="Employe(e)" htmlFor="staff_id">
        <Select id="staff_id" name="staff_id" defaultValue="">
          <option value="">— Indifferent —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date et heure" htmlFor="starts_at">
        <Input id="starts_at" name="starts_at" type="datetime-local" required />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" placeholder="Optionnel" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creation..." : "Creer le rendez-vous"}
      </Button>
    </form>
  );
}
