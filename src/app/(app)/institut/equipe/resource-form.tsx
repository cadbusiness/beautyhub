"use client";

import { useActionState } from "react";
import { createResource, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function ResourceForm() {
  const [state, action, pending] = useActionState(createResource, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label="Nom de la cabine / ressource" htmlFor="name">
        <Input id="name" name="name" required placeholder="Cabine 1" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Ressource ajoutee.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter"}
      </Button>
    </form>
  );
}
