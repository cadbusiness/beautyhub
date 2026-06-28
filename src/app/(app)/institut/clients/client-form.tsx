"use client";

import { useActionState, useEffect, useRef } from "react";
import { createClientRecord, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function ClientForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createClientRecord, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Nom complet" htmlFor="full_name">
        <Input id="full_name" name="full_name" placeholder="Marie Durand" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder="marie@email.com" />
      </Field>
      <Field label="Telephone" htmlFor="phone">
        <Input id="phone" name="phone" placeholder="06 12 34 56 78" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter le client"}
      </Button>
    </form>
  );
}
