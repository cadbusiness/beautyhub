"use client";

import Link from "next/link";
import { useActionState } from "react";
import { clientRegister, type ClientAuthResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initial: ClientAuthResult = {};

export default function ClientRegisterPage() {
  const [state, action, pending] = useActionState(clientRegister, initial);

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Creer un compte</h1>
      <form action={action} className="space-y-4">
        <Field label="Nom complet" htmlFor="full_name">
          <Input id="full_name" name="full_name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input id="password" name="password" type="password" required minLength={8} />
        </Field>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creation..." : "Creer mon compte"}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500">
        <Link href="/client/login" className="underline">
          Deja un compte ?
        </Link>
      </p>
    </Card>
  );
}
