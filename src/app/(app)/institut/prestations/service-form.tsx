"use client";

import { useActionState, useEffect, useRef } from "react";
import { createService, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

const initial: ActionResult = {};

export function ServiceForm() {
  const [state, action, pending] = useActionState(createService, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Nom" htmlFor="name">
        <Input id="name" name="name" required placeholder="Soin du visage" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Duree (min)" htmlFor="duration_min">
          <Input
            id="duration_min"
            name="duration_min"
            type="number"
            min={1}
            defaultValue={30}
            required
          />
        </Field>
        <Field label="Prix (EUR)" htmlFor="price">
          <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue="0" />
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" placeholder="Optionnel" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter la prestation"}
      </Button>
    </form>
  );
}
