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
  progress_points?: number;
  credit_threshold_points?: number;
  next_tranche_cents?: number;
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
  const [editingCredit, setEditingCredit] = useState(false);
  const [pad, setPad] = useState("");

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
  const halfCredit = Math.floor(maxCredit / 2);
  const leftover = Math.max(0, snapshot.balance - selectedCreditCents);

  function setCredit(cents: number) {
    onRewardChange("", 0);
    onCreditChange(Math.max(0, Math.min(maxCredit, cents)));
    setEditingCredit(false);
  }

  function appendPad(token: string) {
    let next = pad;
    if (token === ",") {
      if (!next.includes(",")) next = next.length === 0 ? "0," : `${next},`;
    } else if (token === "back") {
      next = next.slice(0, -1);
    } else if (next.includes(",")) {
      const frac = next.split(",")[1] ?? "";
      if (frac.length < 2) next += token;
    } else if (next === "0") {
      next = token;
    } else {
      next += token;
    }
    setPad(next);
    const n = Number.parseFloat(next.replace(",", "."));
    const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
    onRewardChange("", 0);
    onCreditChange(Math.max(0, Math.min(maxCredit, cents)));
  }

  return (
    <div className="space-y-2 border-b border-slate-100 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {t("title")}
      </p>
      {creditEnabled ? (
        <>
          <p className="text-base font-semibold tabular-nums text-slate-900">
            {formatPrice(snapshot.balance, currency, locale)}
          </p>
          {(() => {
            const threshold = snapshot.credit_threshold_points || 500;
            const progress = snapshot.progress_points ?? 0;
            const reward = formatPrice(
              snapshot.next_tranche_cents || 1750,
              currency,
              locale,
            );
            return (
              <p className="text-xs text-slate-500">
                {t("progress", {
                  current: progress,
                  threshold,
                  missing: Math.max(0, threshold - progress),
                  reward,
                })}
              </p>
            );
          })()}
        </>
      ) : (
        <p className="text-sm tabular-nums text-slate-800">
          {t("balance", { count: snapshot.balance, label: pointsLabel })}
        </p>
      )}
      {!creditEnabled && valueCents > 0 ? (
        <p className="text-xs tabular-nums text-slate-500">
          {t("value", { amount: formatPrice(valueCents, currency, locale) })}
        </p>
      ) : null}

      {creditEnabled ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t("creditHint")}</p>
          {subtotalCents <= 0 ? (
            <p className="text-xs text-slate-500">{t("addItemsToUse")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCredit(0)}
                  className={`h-8 px-2.5 text-xs font-semibold ${
                    selectedCreditCents === 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-900"
                  }`}
                >
                  {t("useNone")}
                </button>
                <button
                  type="button"
                  onClick={() => setCredit(halfCredit)}
                  disabled={halfCredit <= 0}
                  className={`h-8 px-2.5 text-xs font-semibold disabled:opacity-40 ${
                    selectedCreditCents === halfCredit && halfCredit > 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-900"
                  }`}
                >
                  {t("useHalf")}
                </button>
                <button
                  type="button"
                  onClick={() => setCredit(maxCredit)}
                  disabled={maxCredit <= 0}
                  className={`h-8 px-2.5 text-xs font-semibold disabled:opacity-40 ${
                    selectedCreditCents === maxCredit && maxCredit > 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-900"
                  }`}
                >
                  {t("useAll")} · {formatPrice(maxCredit, currency, locale)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCredit(true);
                    setPad(
                      selectedCreditCents > 0
                        ? (selectedCreditCents / 100).toFixed(2).replace(".", ",")
                        : "",
                    );
                  }}
                  className={`h-8 px-2.5 text-xs font-semibold ${
                    editingCredit ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"
                  }`}
                >
                  {t("useCustom")}
                </button>
              </div>
              {selectedCreditCents > 0 ? (
                <p className="text-xs tabular-nums text-slate-600">
                  {t("usedOf", {
                    used: formatPrice(selectedCreditCents, currency, locale),
                    left: formatPrice(leftover, currency, locale),
                  })}
                </p>
              ) : null}
              {editingCredit ? (
                <LoyaltyAmountPad
                  display={pad || "0"}
                  onDigit={(d) => appendPad(d)}
                  onComma={() => appendPad(",")}
                  onBackspace={() => appendPad("back")}
                  onAll={() => {
                    setPad((maxCredit / 100).toFixed(2).replace(".", ","));
                    setCredit(maxCredit);
                  }}
                  onDone={() => setEditingCredit(false)}
                  allLabel={t("useAll")}
                  doneLabel={t("amountOk")}
                />
              ) : null}
            </>
          )}
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

function LoyaltyAmountPad({
  display,
  onDigit,
  onComma,
  onBackspace,
  onAll,
  onDone,
  allLabel,
  doneLabel,
}: {
  display: string;
  onDigit: (digit: string) => void;
  onComma: () => void;
  onBackspace: () => void;
  onAll: () => void;
  onDone: () => void;
  allLabel: string;
  doneLabel: string;
}) {
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];
  return (
    <div className="space-y-2 pt-1">
      <p className="text-center text-xl font-semibold tabular-nums text-slate-900">
        {display} €
      </p>
      {keys.map((row) => (
        <div key={row.join("")} className="grid grid-cols-3 gap-2">
          {row.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              className="h-11 bg-slate-50 text-base font-semibold text-slate-900"
            >
              {digit}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onComma}
          className="h-11 bg-slate-50 text-base font-semibold text-slate-900"
        >
          ,
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          className="h-11 bg-slate-50 text-base font-semibold text-slate-900"
        >
          0
        </button>
        <button
          type="button"
          onClick={onBackspace}
          className="h-11 bg-slate-50 text-base font-semibold text-slate-900"
        >
          ⌫
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAll}
          className="h-11 bg-slate-50 text-sm font-semibold text-slate-900"
        >
          {allLabel}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-11 bg-slate-900 text-sm font-semibold text-white"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
