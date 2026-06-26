"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

export function LoginForm({ setupRequired }: { setupRequired?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="w-full max-w-sm">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        ← BeautyHub
      </Link>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Connexion équipe</h1>
        <p className="mt-1 text-sm text-slate-400">Back-office institut &amp; plateforme.</p>

        {setupRequired ? (
          <p className="mt-4 rounded-lg border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            Base de données non connectée sur ce déploiement. Configure les variables
            Supabase sur Vercel puis redeploie.
          </p>
        ) : null}

        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={setupRequired}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-300">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={setupRequired}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
            />
          </div>

          {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}

          <Button type="submit" className="w-full" disabled={pending || setupRequired}>
            {pending ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
