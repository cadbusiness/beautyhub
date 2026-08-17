"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { assignLoyaltyProgramToClient } from "../../marketing/loyalty-actions";
import { Field, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { ClientLoyaltyCard } from "@/lib/institut/client-loyalty";

export function ClientLoyaltyPanel({
  clientId,
  card,
}: {
  clientId: string;
  card: ClientLoyaltyCard;
}) {
  const t = useTranslations("institut.clients.detail.loyalty");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [programId, setProgramId] = useState(card.assignedProgramId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMessage(null);
    setError(null);
    start(async () => {
      const result = await assignLoyaltyProgramToClient(
        clientId,
        programId || null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? t("saved"));
      router.refresh();
    });
  }

  return (
    <section className="border-t border-slate-200 px-4 py-4 lg:px-6">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {t("title")}
      </h2>
      <dl className="mb-3">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
          <dt className="shrink-0 text-sm text-slate-500">{t("group")}</dt>
          <dd className="text-right text-sm text-slate-900">
            {card.programName ?? t("noProgram")}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
          <dt className="shrink-0 text-sm text-slate-500">{t("balance")}</dt>
          <dd className="text-right text-sm font-medium tabular-nums text-slate-900">
            {t("points", { count: card.balance, label: card.pointsLabel })}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
          <dt className="shrink-0 text-sm text-slate-500">{t("value")}</dt>
          <dd className="text-right text-sm tabular-nums text-slate-900">
            {card.valueCents > 0 ? formatPrice(card.valueCents) : tCommon("dash")}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-sm text-slate-500">{t("progress")}</dt>
          <dd className="text-right text-sm text-slate-900">
            {card.nextReward
              ? t("nextReward", {
                  name: card.nextReward.name,
                  missing: card.nextReward.missing,
                  label: card.pointsLabel,
                })
              : card.balance > 0
                ? t("rewardReady")
                : t("noProgress")}
          </dd>
        </div>
      </dl>
      {card.programs.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Field label={t("assign")} htmlFor="loyalty_program_id">
              <Select
                id="loyalty_program_id"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
              >
                <option value="">{t("assignDefault")}</option>
                {card.programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                    {program.is_active ? ` · ${t("active")}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            type="button"
            className="h-9"
            disabled={pending}
            onClick={save}
          >
            {pending ? tCommon("saving") : t("save")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t("noProgramsHint")}</p>
      )}
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
