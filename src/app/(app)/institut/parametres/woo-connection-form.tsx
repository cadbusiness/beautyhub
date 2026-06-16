"use client";

import { useActionState } from "react";
import { saveWooConnection, type ActionResult } from "../woo-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function WooConnectionForm({ defaultUrl }: { defaultUrl?: string }) {
  const [state, action, pending] = useActionState(saveWooConnection, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label="URL de la boutique" htmlFor="url">
        <Input
          id="url"
          name="url"
          type="url"
          required
          defaultValue={defaultUrl}
          placeholder="https://maboutique.com"
        />
      </Field>
      <Field label="Consumer key" htmlFor="consumer_key">
        <Input id="consumer_key" name="consumer_key" required placeholder="ck_..." />
      </Field>
      <Field label="Consumer secret" htmlFor="consumer_secret">
        <Input
          id="consumer_secret"
          name="consumer_secret"
          type="password"
          required
          placeholder="cs_..."
        />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Test et enregistrement..." : "Connecter WooCommerce"}
      </Button>
    </form>
  );
}
