import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/compliance/legal-shell";

export default async function LegalPrivacyPage() {
  const t = await getTranslations("legal.privacy");

  const sections = ["1", "2", "3", "4", "5", "6", "7"] as const;

  return (
    <LegalShell title={t("title")}>
      <p className="text-slate-600">{t("intro")}</p>
      <p className="mt-4 text-xs text-slate-400">{t("updated")}</p>
      {sections.map((n) => (
        <section key={n} className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">{t(`sections.${n}.title`)}</h2>
          <p className="mt-2 whitespace-pre-line text-slate-600">
            {t(`sections.${n}.body`)}
          </p>
        </section>
      ))}
    </LegalShell>
  );
}
