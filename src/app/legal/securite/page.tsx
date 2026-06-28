import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LegalShell } from "@/components/compliance/legal-shell";
import { SECURITY_METRICS } from "@/lib/compliance/subprocessors";

export default async function LegalSecurityPage() {
  const t = await getTranslations("legal.security");

  const metrics = [
    { label: t("metrics.rls"), value: SECURITY_METRICS.rlsEnabled ? t("yes") : t("no") },
    {
      label: t("metrics.encryption"),
      value: SECURITY_METRICS.credentialsEncryption,
    },
    {
      label: t("metrics.isolation"),
      value: SECURITY_METRICS.tenantIsolation ? t("yes") : t("no"),
    },
    { label: t("metrics.auth"), value: SECURITY_METRICS.authProvider },
  ];

  return (
    <LegalShell title={t("title")}>
      <p className="text-slate-600">{t("intro")}</p>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-slate-900">{t("metricsTitle")}</h2>
        <dl className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          {metrics.map((m) => (
            <div key={m.label} className="flex justify-between gap-4 py-3">
              <dt className="text-slate-500">{m.label}</dt>
              <dd className="font-medium text-slate-900">{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-slate-900">{t("roadmapTitle")}</h2>
        <p className="mt-2 whitespace-pre-line text-slate-600">{t("roadmapBody")}</p>
      </section>

      <p className="mt-8 text-sm text-slate-600">
        {t("certificationsNote")}{" "}
        <Link href="/legal/confidentialite" className="underline">
          {t("privacyLink")}
        </Link>
      </p>
    </LegalShell>
  );
}
