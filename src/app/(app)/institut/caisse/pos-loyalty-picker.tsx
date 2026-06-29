"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  points_label?: string;
  balance: number;
  rewards: LoyaltyRewardOption[];
};

export function PosLoyaltyPicker({
  clientId,
  subtotalCents,
  selectedRewardId,
  onRewardChange,
}: {
  clientId: string;
  subtotalCents: number;
  selectedRewardId: string;
  onRewardChange: (rewardId: string, discountCents: number) => void;
}) {
  const t = useTranslations("pos.loyalty");
  const [snapshot, setSnapshot] = useState<LoyaltySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setSnapshot(null);
      onRewardChange("", 0);
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

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-800">
          {t("title")}
        </p>
        <p className="text-xs tabular-nums text-violet-700">
          {t("balance", { count: snapshot.balance, label: pointsLabel })}
        </p>
      </div>

      {eligibleRewards.length === 0 ? (
        <p className="mt-2 text-xs text-violet-700/80">{t("noRewards")}</p>
      ) : (
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
                    {discount > 0 ? ` · −${formatPrice(discount)}` : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
