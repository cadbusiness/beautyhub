"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { regenerateClientPinAction, type ActionResult } from "../../actions";
import { Button } from "@/components/ui/button";
import type { ClientRow } from "@/lib/institut/clients";

const initial: ActionResult = {};

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(value)}
      className="ml-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      aria-label={label}
    >
      {label}
    </button>
  );
}

export function ClientAccessPanel({ client }: { client: ClientRow }) {
  const t = useTranslations("institut.clients.detail");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [state, action, pending] = useActionState(regenerateClientPinAction, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <div className="space-y-0">
      <section className="px-4 py-4 lg:px-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("accessTitle")}
        </h2>
        <dl>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{t("loginId")}</dt>
            <dd className="text-right text-sm font-medium tabular-nums text-slate-900">
              {client.login_id ?? tCommon("dash")}
              {client.login_id ? (
                <CopyButton value={client.login_id} label={t("copy")} />
              ) : null}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{t("pinCode")}</dt>
            <dd className="text-right text-sm font-medium tabular-nums tracking-widest text-slate-900">
              {client.pin_code ?? tCommon("dash")}
              {client.pin_code ? (
                <CopyButton value={client.pin_code} label={t("copy")} />
              ) : null}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{t("portalAccount")}</dt>
            <dd className="text-right text-sm text-slate-900">
              {client.has_portal_account ? t("portalActive") : t("portalInactive")}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{tCommon("email")}</dt>
            <dd className="text-right text-sm text-slate-900">{client.email}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{t("marketingOptIn")}</dt>
            <dd className="text-right text-sm text-slate-900">
              {client.marketing_opt_in ? tCommon("yes") : tCommon("no")}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-slate-500">{t("accessHint")}</p>

        <form action={action} className="mt-4">
          <input type="hidden" name="client_id" value={client.id} />
          <Button type="submit" variant="outline" className="h-9" disabled={pending}>
            {pending ? t("regeneratePinSubmitting") : t("regeneratePin")}
          </Button>
          {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        </form>
      </section>

      <section className="border-t border-slate-200 px-4 py-4 lg:px-6">
        <p className="text-sm text-slate-600">{t("emailsComingSoon")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("emailsHint")}</p>
      </section>
    </div>
  );
}
