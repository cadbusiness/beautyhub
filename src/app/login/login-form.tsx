"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signIn, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initialState: AuthState = {};

const TEST_PASSWORD = "BeautyHub2026!";

const TEST_ACCOUNT_KEYS = [
  { email: "admin@beautyhub.test", roleKey: "platformAdmin" as const },
  { email: "brand@beautyhub.test", roleKey: "brandOwner" as const },
  { email: "owner@demo.test", roleKey: "demoOwner" as const },
  { email: "staff@demo.test", roleKey: "demoStaff" as const },
  { email: "coach@demo.test", roleKey: "demoCoach" as const },
];

export function LoginForm({ setupRequired }: { setupRequired?: boolean }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function fillAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(TEST_PASSWORD);
  }

  return (
    <div className="w-full max-w-sm">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        {t("backToHome")}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>

        {setupRequired ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("setupRequired")}
          </p>
        ) : null}

        <form action={formAction} className="mt-6 space-y-4">
          <Field label={tCommon("email")} htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={setupRequired}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={tCommon("password")} htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={setupRequired}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <Button type="submit" className="w-full" disabled={pending || setupRequired}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>

        {!setupRequired ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("testAccounts.title")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t("testAccounts.sharedPassword")}{" "}
              <span className="font-mono text-slate-700">{TEST_PASSWORD}</span>
            </p>
            <ul className="mt-3 space-y-2">
              {TEST_ACCOUNT_KEYS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => fillAccount(a.email)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
                  >
                    <p className="font-mono text-xs text-slate-800">{a.email}</p>
                    <p className="text-xs text-slate-500">{t(`testAccounts.roles.${a.roleKey}`)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
