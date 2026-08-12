"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveInstitutDomain, type DomainActionResult } from "./domain-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { TenantDomainSettings } from "@/lib/institut/tenant-domain";

const initial: DomainActionResult = {};

export function InstitutDomainForm({
  settings,
}: {
  settings: TenantDomainSettings;
}) {
  const t = useTranslations("account.domain");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveInstitutDomain, initial);

  const links = [
    { label: t("links.site"), href: settings.publicBaseUrl },
    { label: t("links.booking"), href: `${settings.publicBaseUrl}/reserver` },
    {
      label: t("links.clientLogin"),
      href: `${settings.publicBaseUrl}/client/login`,
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={action} className="space-y-5">
        <p className="text-sm text-slate-600">{t("description")}</p>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? (
          <p className="text-sm text-green-600">{state.message ?? t("saved")}</p>
        ) : null}

        <Field label={t("subdomain")}>
          <Input value={settings.subdomainUrl} readOnly className="font-mono text-sm" />
          <p className="mt-1.5 text-xs text-slate-500">{t("subdomainHint")}</p>
        </Field>

        <Field label={t("customDomain")} htmlFor="custom_domain">
          <Input
            id="custom_domain"
            name="custom_domain"
            defaultValue={settings.customDomain ?? ""}
            placeholder={t("customDomainPlaceholder")}
            className="font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-slate-500">{t("customDomainHint")}</p>
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("dnsTitle")}
          </p>
          <p className="mt-2 text-sm text-slate-600">{t("dnsBody")}</p>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            CNAME → cname.vercel-dns.com
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("linksTitle")}
          </p>
          <ul className="mt-3 space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <p className="text-xs text-slate-500">{link.label}</p>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-sm text-slate-900 underline-offset-2 hover:underline"
                >
                  {link.href}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
