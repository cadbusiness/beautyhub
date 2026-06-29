import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";
import { createClient } from "@/lib/supabase/server";
import { loadPublicLoyaltyView } from "@/lib/institut/loyalty-public";

export default async function FidelitePublicPage() {
  const tenant = await getPublicSiteTenant();
  if (!tenant) redirect("/");

  const t = await getTranslations("public.loyalty");
  const supabase = await createClient();
  const view = await loadPublicLoyaltyView(supabase, tenant.id);

  if (!view) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{t("unavailableTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("unavailableBody")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <header className="text-center">
        <p className="text-sm text-slate-500">{tenant.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{view.programName}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("intro")}</p>
      </header>

      {view.rewards.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-slate-700">{t("rewardsTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {view.rewards.map((reward) => (
              <li
                key={reward.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <p className="font-medium text-slate-900">{reward.name}</p>
                {reward.description ? (
                  <p className="mt-0.5 text-sm text-slate-500">{reward.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">
                  {t("pointsCost", {
                    cost: reward.pointsCost,
                    label: view.pointsLabel,
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          href="/client/login"
          className="inline-flex h-10 w-full max-w-xs items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {t("loginCta")}
        </Link>
        <Link href="/client/compte" className="text-sm text-slate-500 underline-offset-2 hover:underline">
          {t("accountLink")}
        </Link>
      </div>
    </main>
  );
}
