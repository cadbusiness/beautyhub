import { getTranslations } from "next-intl/server";
import type { ClientLoyaltyPortalView } from "@/lib/institut/loyalty-portal";

export async function ClientLoyaltyPanel({ loyalty }: { loyalty: ClientLoyaltyPortalView }) {
  const t = await getTranslations("public.client.account.loyalty");

  return (
    <section className="border-b border-slate-200 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-slate-900">{loyalty.programName}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {loyalty.balance}{" "}
          <span className="text-sm font-normal text-slate-500">{loyalty.pointsLabel}</span>
        </p>
      </div>

      {loyalty.rewards.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {loyalty.rewards.map((reward) => (
            <li key={reward.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{reward.name}</p>
                <p className="text-xs text-slate-500">
                  {reward.summary}
                  {reward.newServiceOnly ? ` · ${t("newServiceOnly")}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-600">
                {reward.pointsCost} {loyalty.pointsLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{t("noRewards")}</p>
      )}

      <p className="mt-2 text-xs text-slate-400">{t("redeemSoon")}</p>
    </section>
  );
}
