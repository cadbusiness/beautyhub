"use client";

import { useActionState, useEffect, useRef } from "react";
import { createResource, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function ResourceForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createResource, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Nom de la cabine / ressource" htmlFor="name">
        <Input id="name" name="name" required placeholder="Cabine 1" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter"}
      </Button>
    </form>
  );
}
