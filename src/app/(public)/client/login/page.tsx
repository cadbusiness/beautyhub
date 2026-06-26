"use client";

import Link from "next/link";
import { useActionState } from "react";
import { clientLogin, type ClientAuthResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initial: ClientAuthResult = {};

export default function ClientLoginPage() {
  const [state, action, pending] = useActionState(clientLogin, initial);

  return (
    <Card className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Mon compte</h1>
      <p className="text-sm text-slate-500">Connectez-vous pour voir vos rendez-vous.</p>
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500">
        Pas de compte ?{" "}
        <Link href="/client/inscription" className="text-slate-900 underline dark:text-white">
          Creer un compte
        </Link>
      </p>
    </Card>
  );
}
