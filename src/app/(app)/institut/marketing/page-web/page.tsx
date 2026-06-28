import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function MarketingPageWebPage() {
  const t = await getTranslations("institut.marketing.website");
  const session = await requireModule("institut");
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const publicHost = `${session.tenant.slug}.${rootDomain}`;

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <Card className="max-w-2xl space-y-5 p-6 shadow-none">
        <div>
          <h2 className="font-medium text-slate-900">{t("title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("publicUrlLabel")}
          </p>
          <p className="break-all font-mono text-sm text-slate-800">
            https://{publicHost}/reserver
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/reserver"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50",
            )}
          >
            {t("preview")}
          </Link>
        </div>

        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("hint")}
        </p>
      </Card>
    </div>
  );
}
