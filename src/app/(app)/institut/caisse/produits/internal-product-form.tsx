"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInternalProduct, type ActionResult } from "../../caisse-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

export function InternalProductForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(createInternalProduct, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="Nom" htmlFor="name">
        <Input id="name" name="name" required placeholder="Huile visage 30ml" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prix (EUR)" htmlFor="price">
          <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue="0" />
        </Field>
        <Field label="Stock" htmlFor="stock_quantity">
          <Input
            id="stock_quantity"
            name="stock_quantity"
            type="number"
            min={0}
            placeholder="Optionnel"
          />
        </Field>
      </div>
      <Field label="SKU" htmlFor="sku">
        <Input id="sku" name="sku" placeholder="Optionnel" />
      </Field>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter le produit"}
      </Button>
    </form>
  );
}
