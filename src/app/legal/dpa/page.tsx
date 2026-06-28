import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/compliance/legal-shell";
import { Button } from "@/components/ui/button";

export default async function LegalDpaPage() {
  const t = await getTranslations("legal.dpa");

  return (
    <LegalShell title={t("title")}>
      <p className="text-slate-600">{t("intro")}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">
        <li>{t("points.controller")}</li>
        <li>{t("points.processor")}</li>
        <li>{t("points.signature")}</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/api/legal/dpa">
          <Button type="button" className="h-10">
            {t("download")}
          </Button>
        </Link>
        <Link href="/compte/institut/conformite">
          <Button type="button" variant="outline" className="h-10">
            {t("institutChecklist")}
          </Button>
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-400">{t("disclaimer")}</p>
    </LegalShell>
  );
}
