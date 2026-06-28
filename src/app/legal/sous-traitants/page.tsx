import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/compliance/legal-shell";
import { PLATFORM_SUBPROCESSORS } from "@/lib/compliance/subprocessors";

export default async function LegalSubprocessorsPage() {
  const t = await getTranslations("legal.subprocessors");

  return (
    <LegalShell title={t("title")}>
      <p className="text-slate-600">{t("intro")}</p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">{t("columns.name")}</th>
              <th className="py-2 pr-4">{t("columns.purpose")}</th>
              <th className="py-2 pr-4">{t("columns.location")}</th>
              <th className="py-2">{t("columns.safeguards")}</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORM_SUBPROCESSORS.map((sp) => (
              <tr key={sp.name} className="border-b border-slate-100">
                <td className="py-3 pr-4 font-medium text-slate-900">{sp.name}</td>
                <td className="py-3 pr-4 text-slate-600">
                  {t(
                    `purposes.${sp.purposeKey}` as
                      | "purposes.database"
                      | "purposes.hosting"
                      | "purposes.payments"
                      | "purposes.ai",
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {t(
                    `locations.${sp.locationKey}` as
                      | "locations.euUs"
                      | "locations.global"
                      | "locations.us",
                  )}
                </td>
                <td className="py-3 text-slate-600">
                  {t(
                    `safeguards.${sp.safeguardsKey}` as
                      | "safeguards.dpaScc"
                      | "safeguards.dpaOptIn",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-slate-400">{t("note")}</p>
    </LegalShell>
  );
}
