"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils";
import { computeRewardDiscountCents } from "@/lib/institut/loyalty-redeem";
import { cn } from "@/lib/utils";

type LoyaltyRewardOption = {
  id: string;
  name: string;
  points_cost: number;
  reward_type: "discount_percent" | "discount_fixed";
  discount_percent: number | null;
  discount_cents: number | null;
  eligible: boolean;
  ineligible_code: string | null;
};

type LoyaltySnapshot = {
  active: boolean;
  program_id?: string;
  program_name?: string;
  points_label?: string;
  balance: number;
  value_cents?: number;
  credit_enabled?: boolean;
  credit_rate_bps?: number;
  rewards: LoyaltyRewardOption[];
};

export function PosLoyaltyPicker({
  clientId,
  subtotalCents,
  selectedRewardId,
  selectedCreditCents,
  onRewardChange,
  onCreditChange,
  currency = "eur",
}: {
  clientId: string;
  subtotalCents: number;
  selectedRewardId: string;
  selectedCreditCents: number;
  onRewardChange: (rewardId: string, discountCents: number) => void;
  onCreditChange: (creditCents: number) => void;
  currency?: string;
}) {
  const t = useTranslations("pos.loyalty");
  const locale = useLocale();
  const [snapshot, setSnapshot] = useState<LoyaltySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setSnapshot(null);
      onRewardChange("", 0);
      onCreditChange(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/institut/pos/client-loyalty?client_id=${encodeURIComponent(clientId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("load_failed");
        return (await res.json()) as LoyaltySnapshot;
      })
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        if (selectedRewardId) {
          const reward = data.rewards?.find((r) => r.id === selectedRewardId && r.eligible);
          if (!reward) onRewardChange("", 0);
        }
        if (selectedCreditCents > 0 && !data.credit_enabled) {
          onCreditChange(0);
        }
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when client changes
  }, [clientId]);

  function selectReward(rewardId: string, reward?: LoyaltyRewardOption) {
    const discount =
      reward && subtotalCents > 0
        ? computeRewardDiscountCents(reward, subtotalCents)
        : 0;
    onRewardChange(rewardId, discount);
  }

  useEffect(() => {
    if (!selectedRewardId || !snapshot) return;
    const reward = snapshot.rewards.find((r) => r.id === selectedRewardId && r.eligible);
    if (reward) {
      onRewardChange(
        selectedRewardId,
        computeRewardDiscountCents(reward, subtotalCents),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalc discount when subtotal changes
  }, [subtotalCents, selectedRewardId, snapshot]);

  if (!clientId) return null;
  if (loading) {
    return <p className="text-xs text-slate-400">{t("loading")}</p>;
  }
  if (!snapshot?.active) return null;

  const pointsLabel = snapshot.points_label ?? t("pointsDefault");
  const eligibleRewards = snapshot.rewards.filter((r) => r.eligible);
  const valueCents = snapshot.value_cents ?? 0;
  const creditEnabled = Boolean(snapshot.credit_enabled);
  const maxCredit = Math.max(0, Math.min(snapshot.balance, subtotalCents));
  const creditEuros =
    selectedCreditCents > 0 ? (selectedCreditCents / 100).toFixed(2) : "";

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-800">
            {t("title")}
          </p>
          {snapshot.program_name ? (
            <p className="mt-0.5 text-xs text-violet-700">{snapshot.program_name}</p>
          ) : null}
        </div>
        <div className="text-right">
          {creditEnabled ? (
            <p className="text-sm font-semibold tabular-nums text-violet-950">
              {t("creditBalance", {
                amount: formatPrice(snapshot.balance, currency, locale),
              })}
            </p>
          ) : (
            <p className="text-xs tabular-nums text-violet-700">
              {t("balance", { count: snapshot.balance, label: pointsLabel })}
            </p>
          )}
          {!creditEnabled && valueCents > 0 ? (
            <p className="mt-0.5 text-xs font-medium tabular-nums text-violet-900">
              {t("value", { amount: formatPrice(valueCents, currency, locale) })}
            </p>
          ) : null}
        </div>
      </div>

      {creditEnabled ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-violet-700/80">{t("creditHint")}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              max={(maxCredit / 100).toFixed(2)}
              value={creditEuros}
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value.replace(",", "."));
                const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
                onRewardChange("", 0);
                onCreditChange(Math.max(0, Math.min(maxCredit, cents)));
              }}
              placeholder="0,00"
              className="h-8 w-28 rounded-md border border-violet-200 bg-white px-2 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={() => {
                onRewardChange("", 0);
                onCreditChange(maxCredit);
              }}
              disabled={maxCredit <= 0}
              className="text-xs font-medium text-violet-800 hover:underline disabled:opacity-40"
            >
              {t("useAll")}
            </button>
            {selectedCreditCents > 0 ? (
              <button
                type="button"
                onClick={() => onCreditChange(0)}
                className="text-xs text-violet-700 hover:underline"
              >
                {t("none")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!creditEnabled && eligibleRewards.length === 0 ? (
        <p className="mt-2 text-xs text-violet-700/80">{t("noRewards")}</p>
      ) : !creditEnabled ? (
        <ul className="mt-2 space-y-1.5">
          <li>
            <button
              type="button"
              onClick={() => selectReward("")}
              className={cn(
                "w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                !selectedRewardId
                  ? "border-violet-400 bg-white text-violet-950"
                  : "border-transparent bg-white/60 text-violet-800 hover:bg-white",
              )}
            >
              {t("none")}
            </button>
          </li>
          {eligibleRewards.map((reward) => {
            const discount = computeRewardDiscountCents(reward, subtotalCents);
            const selected = selectedRewardId === reward.id;
            return (
              <li key={reward.id}>
                <button
                  type="button"
                  onClick={() => selectReward(reward.id, reward)}
                  className={cn(
                    "w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                    selected
                      ? "border-violet-400 bg-white text-violet-950"
                      : "border-transparent bg-white/60 text-violet-800 hover:bg-white",
                  )}
                >
                  <span className="font-medium">{reward.name}</span>
                  <span className="mt-0.5 block text-violet-700/90">
                    {t("cost", { count: reward.points_cost, label: pointsLabel })}
                    {discount > 0 ? ` · −${formatPrice(discount, currency, locale)}` : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
