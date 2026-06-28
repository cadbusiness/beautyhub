"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  deleteLoyaltyEarnRule,
  deleteLoyaltyReward,
  saveLoyaltyEarnRule,
  saveLoyaltyProgramSettings,
  saveLoyaltyReward,
  type ActionResult,
} from "./loyalty-actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { cn, formatPrice } from "@/lib/utils";
import {
  calcPointsForRule,
  defaultCalcModeForSource,
  type LoyaltyCalcMode,
  type LoyaltyEarnRule,
  type LoyaltyIntegrations,
  type LoyaltyProgramSnapshot,
  type LoyaltyReward,
  type LoyaltyRewardType,
  type LoyaltySourceType,
} from "@/lib/institut/loyalty";

const initial: ActionResult = {};

type ServiceOption = { id: string; name: string };

type ProgramStatus = "draft" | "ready" | "live";

function deriveProgramStatus(
  hasRules: boolean,
  hasRewards: boolean,
  isActive: boolean,
): ProgramStatus {
  if (isActive && hasRules) return "live";
  if (hasRules && hasRewards) return "ready";
  return "draft";
}

function sourceAvailable(
  source: LoyaltySourceType,
  integrations: LoyaltyIntegrations,
): boolean {
  if (source === "woocommerce_order") return integrations.woocommerce;
  if (source === "shopify_order") return integrations.shopify;
  return true;
}

function ProgramStatusBadge({ status, label }: { status: ProgramStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "live" && "bg-green-100 text-green-700",
        status === "ready" && "bg-amber-100 text-amber-800",
        status === "draft" && "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function SetupStepsInline({
  steps,
}: {
  steps: { label: string; done: boolean; current: boolean }[];
}) {
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1">
          {index > 0 ? <span className="text-slate-300">→</span> : null}
          <span
            className={cn(
              step.done && "text-green-700",
              step.current && "font-medium text-slate-900",
              !step.done && !step.current && "text-slate-400",
            )}
          >
            {step.done ? "✓ " : null}
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StatCell({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="px-4 py-3 lg:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function LoyaltyManager({
  snapshot,
  integrations,
  services,
}: {
  snapshot: LoyaltyProgramSnapshot;
  integrations: LoyaltyIntegrations;
  services: ServiceOption[];
}) {
  const t = useTranslations("institut.marketing.loyalty");
  const tCommon = useTranslations("common");
  const [programState, programAction, programPending] = useActionState(
    saveLoyaltyProgramSettings,
    initial,
  );
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LoyaltyEarnRule | null>(null);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [pendingDelete, startDelete] = useTransition();

  const { program, rules, rewards, stats } = snapshot;

  function openCreateRule() {
    setEditingRule(null);
    setRuleDialogOpen(true);
  }

  function openEditRule(rule: LoyaltyEarnRule) {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  }

  function openCreateReward() {
    setEditingReward(null);
    setRewardDialogOpen(true);
  }

  function openEditReward(reward: LoyaltyReward) {
    setEditingReward(reward);
    setRewardDialogOpen(true);
  }

  function handleDeleteRule(id: string) {
    if (!confirm(t("rules.deleteConfirm"))) return;
    startDelete(async () => {
      await deleteLoyaltyEarnRule(id);
    });
  }

  function handleDeleteReward(id: string) {
    if (!confirm(t("rewards.deleteConfirm"))) return;
    startDelete(async () => {
      await deleteLoyaltyReward(id);
    });
  }

  const hasRules = rules.length > 0;
  const hasRewards = rewards.length > 0;
  const programStatus = deriveProgramStatus(hasRules, hasRewards, program.is_active);

  const setupSteps = [
    { label: t("setup.step1"), done: hasRules, current: !hasRules },
    { label: t("setup.step2"), done: hasRewards, current: hasRules && !hasRewards },
    {
      label: t("setup.step3"),
      done: program.is_active,
      current: hasRules && hasRewards && !program.is_active,
    },
  ];

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 text-sm text-slate-500">{t("description")}</p>
          <ProgramStatusBadge
            status={programStatus}
            label={t(`programStatus.${programStatus}`)}
          />
        </div>
        <SetupStepsInline steps={setupSteps} />
      </div>

      <div className="grid divide-y border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <StatCell
          label={t("stats.clientsWithPoints")}
          value={stats.clientsWithPoints}
          hint={t("stats.clientsHint")}
        />
        <StatCell
          label={t("stats.pointsOutstanding", { label: program.points_label })}
          value={stats.totalPointsOutstanding}
          hint={t("stats.pointsHint", { label: program.points_label })}
        />
      </div>

      <div className="border-b border-slate-200 px-4 py-3 lg:px-6">
        <p className="text-sm font-medium text-slate-700">{t("program.title")}</p>
        <p className="mt-0.5 text-xs text-slate-500">{t("program.description")}</p>
      </div>
      <form
        action={programAction}
        className="space-y-4 border-b border-slate-200 px-4 py-4 lg:px-6"
      >
        {programState.error ? (
          <p className="text-sm text-red-600">{programState.error}</p>
        ) : null}
        {programState.ok ? (
          <p className="text-sm text-green-600">{programState.message ?? t("program.saved")}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("program.name")} htmlFor="loyalty_name">
            <Input id="loyalty_name" name="name" defaultValue={program.name} required />
          </Field>
          <Field label={t("program.pointsLabel")} htmlFor="loyalty_points_label">
            <Input
              id="loyalty_points_label"
              name="points_label"
              defaultValue={program.points_label}
              required
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="1"
            defaultChecked={program.is_active}
            className="rounded border-slate-300"
          />
          {t("program.active")}
        </label>

        <Button type="submit" className="h-9" disabled={programPending}>
          {programPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </form>

      <ListToolbar
        action={
          <Button onClick={openCreateRule} className="h-9 w-full sm:w-auto">
            + {t("rules.add")}
          </Button>
        }
      >
        <div>
          <p className="text-sm font-medium text-slate-700">{t("rules.title")}</p>
          <p className="text-xs text-slate-500">{t("rules.sectionDescription")}</p>
        </div>
      </ListToolbar>
      <DataTable>
        <table className="w-full text-sm">
          <thead>
            <tr className={dataTableRow}>
              <th className={dataTableHead}>{t("rules.columns.name")}</th>
              <th className={dataTableHead}>{t("rules.columns.source")}</th>
              <th className={dataTableHead}>{t("rules.columns.earning")}</th>
              <th className={dataTableHead}>{t("rules.columns.status")}</th>
              <th className={dataTableHead}>{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${dataTableCell} text-slate-500`}>
                  {t("rules.empty")}
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className={dataTableRow}>
                  <td className={`${dataTableCell} font-medium text-slate-900`}>{rule.name}</td>
                  <td className={dataTableCell}>{t(`sources.${rule.source_type}`)}</td>
                  <td className={dataTableCell}>{formatRuleEarning(rule, t)}</td>
                  <td className={dataTableCell}>
                    {rule.is_active ? t("status.active") : t("status.inactive")}
                  </td>
                  <td className={dataTableCell}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        {tCommon("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={pendingDelete}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTable>
      <ListPanelFooter>{t("rules.footer", { count: rules.length })}</ListPanelFooter>

      <ListToolbar
        action={
          <Button onClick={openCreateReward} className="h-9 w-full sm:w-auto">
            + {t("rewards.add")}
          </Button>
        }
      >
        <div>
          <p className="text-sm font-medium text-slate-700">{t("rewards.title")}</p>
          <p className="text-xs text-slate-500">{t("rewards.sectionDescription")}</p>
        </div>
      </ListToolbar>
      <DataTable>
        <table className="w-full text-sm">
          <thead>
            <tr className={dataTableRow}>
              <th className={dataTableHead}>{t("rewards.columns.name")}</th>
              <th className={dataTableHead}>{t("rewards.columns.type")}</th>
              <th className={dataTableHead}>{t("rewards.columns.cost")}</th>
              <th className={dataTableHead}>{t("rewards.columns.status")}</th>
              <th className={dataTableHead}>{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rewards.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${dataTableCell} text-slate-500`}>
                  {t("rewards.empty")}
                </td>
              </tr>
            ) : (
              rewards.map((reward) => (
                <tr key={reward.id} className={dataTableRow}>
                  <td className={`${dataTableCell} font-medium text-slate-900`}>{reward.name}</td>
                  <td className={dataTableCell}>{formatRewardType(reward, services, t)}</td>
                  <td className={dataTableCell}>
                    {reward.points_cost} {program.points_label}
                  </td>
                  <td className={dataTableCell}>
                    {reward.is_active ? t("status.active") : t("status.inactive")}
                  </td>
                  <td className={dataTableCell}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditReward(reward)}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        {tCommon("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(reward.id)}
                        disabled={pendingDelete}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTable>
      <ListPanelFooter>{t("rewards.footer", { count: rewards.length })}</ListPanelFooter>
      <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 lg:px-6">
        {t("rewards.redeemHint")}
      </p>

      <div className="border-t border-slate-200 px-4 py-2.5 lg:px-6">
        <p className="text-sm font-medium text-slate-700">{t("share.title")}</p>
        <p className="text-xs text-slate-500">{t("share.description")}</p>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-200 text-sm">
        <li className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{t("share.qrTitle")}</p>
            <p className="text-xs text-slate-500">{t("share.qrDescription")}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{t("share.comingSoon")}</span>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{t("share.walletTitle")}</p>
            <p className="text-xs text-slate-500">{t("share.walletDescription")}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{t("share.comingSoon")}</span>
        </li>
      </ul>

      <EarnRuleDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        rule={editingRule}
        integrations={integrations}
        pointsLabel={program.points_label}
      />

      <RewardDialog
        open={rewardDialogOpen}
        onClose={() => setRewardDialogOpen(false)}
        reward={editingReward}
        services={services}
        pointsLabel={program.points_label}
      />
    </>
  );
}

function formatRuleEarning(
  rule: LoyaltyEarnRule,
  t: ReturnType<typeof useTranslations<"institut.marketing.loyalty">>,
): string {
  if (rule.calc_mode === "fixed_per_event") {
    return t("rules.earningFixed", { points: rule.points_value });
  }
  const example = calcPointsForRule(rule, 5000);
  return t("rules.earningPerEuro", { points: rule.points_value, example });
}

function formatRewardType(
  reward: LoyaltyReward,
  services: ServiceOption[],
  t: ReturnType<typeof useTranslations<"institut.marketing.loyalty">>,
): string {
  if (reward.reward_type === "discount_percent") {
    return t("rewards.types.discountPercent", { percent: reward.discount_percent ?? 0 });
  }
  if (reward.reward_type === "discount_fixed") {
    return t("rewards.types.discountFixed", {
      amount: formatPrice(reward.discount_cents ?? 0),
    });
  }
  const service = services.find((s) => s.id === reward.service_id);
  return t("rewards.types.freeService", { service: service?.name ?? "—" });
}

function EarnRuleDialog({
  open,
  onClose,
  rule,
  integrations,
  pointsLabel,
}: {
  open: boolean;
  onClose: () => void;
  rule: LoyaltyEarnRule | null;
  integrations: LoyaltyIntegrations;
  pointsLabel: string;
}) {
  const t = useTranslations("institut.marketing.loyalty");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveLoyaltyEarnRule, initial);
  const defaultSource: LoyaltySourceType = "appointment_completed";
  const [sourceType, setSourceType] = useState<LoyaltySourceType>(
    rule?.source_type ?? defaultSource,
  );
  const [calcMode, setCalcMode] = useState<LoyaltyCalcMode>(
    rule?.calc_mode ?? defaultCalcModeForSource(defaultSource),
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    if (open) {
      setSourceType(rule?.source_type ?? defaultSource);
      setCalcMode(rule?.calc_mode ?? defaultCalcModeForSource(rule?.source_type ?? defaultSource));
    }
  }, [open, rule, defaultSource]);

  const previewPoints = useMemo(() => {
    const pointsValue = rule?.points_value ?? (sourceType === "appointment_completed" ? 10 : 1);
    const sampleRule = { calc_mode: calcMode, points_value: pointsValue };
    return calcMode === "fixed_per_event"
      ? pointsValue
      : calcPointsForRule(sampleRule, 5000);
  }, [calcMode, rule?.points_value, sourceType]);

  const wooConnected = integrations.woocommerce;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={rule ? t("rules.editTitle") : t("rules.createTitle")}
      size="lg"
    >
      <form action={action} className="space-y-4">
        {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <Field label={t("rules.form.name")} htmlFor="rule_name">
          <Input
            id="rule_name"
            name="name"
            defaultValue={rule?.name ?? ""}
            placeholder={t("rules.form.namePlaceholder")}
            required
          />
        </Field>

        <Field label={t("rules.form.source")} htmlFor="rule_source">
          <Select
            id="rule_source"
            name="source_type"
            value={sourceType}
            onChange={(e) => {
              const next = e.target.value as LoyaltySourceType;
              setSourceType(next);
              setCalcMode(defaultCalcModeForSource(next));
            }}
          >
            <option value="appointment_completed">{t("sources.appointment_completed")}</option>
            <option value="pos_sale">{t("sources.pos_sale")}</option>
            <option value="woocommerce_order" disabled={!wooConnected}>
              {t("sources.woocommerce_order")}
              {!wooConnected ? ` (${t("integrations.wooDisconnected")})` : ""}
            </option>
            <option value="shopify_order" disabled>
              {t("sources.shopify_order")} ({t("integrations.comingSoon")})
            </option>
          </Select>
        </Field>

        {!sourceAvailable(sourceType, integrations) && sourceType !== "shopify_order" ? (
          <p className="text-sm text-amber-700">
            {t("integrations.connectHint")}{" "}
            <Link href="/compte/institut/woocommerce" className="underline">
              WooCommerce
            </Link>
          </p>
        ) : null}

        <Field label={t("rules.form.calcMode")} htmlFor="rule_calc_mode">
          <Select
            id="rule_calc_mode"
            name="calc_mode"
            value={calcMode}
            onChange={(e) => setCalcMode(e.target.value as LoyaltyCalcMode)}
          >
            <option value="fixed_per_event">{t("calcModes.fixed_per_event")}</option>
            <option value="per_euro_spent">{t("calcModes.per_euro_spent")}</option>
          </Select>
        </Field>

        <Field
          label={
            calcMode === "fixed_per_event"
              ? t("rules.form.pointsFixed", { label: pointsLabel })
              : t("rules.form.pointsPerEuro", { label: pointsLabel })
          }
          htmlFor="rule_points"
        >
          <Input
            id="rule_points"
            name="points_value"
            type="number"
            min={1}
            step={1}
            defaultValue={rule?.points_value ?? (sourceType === "appointment_completed" ? 10 : 1)}
            required
          />
        </Field>

        {sourceType !== "appointment_completed" ? (
          <Field label={t("rules.form.minAmount")} htmlFor="rule_min_amount">
            <Input
              id="rule_min_amount"
              name="min_amount_eur"
              type="number"
              min={0}
              step={0.01}
              defaultValue={(rule?.min_amount_cents ?? 0) / 100}
            />
          </Field>
        ) : (
          <input type="hidden" name="min_amount_eur" value="0" />
        )}

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t("rules.form.preview", { points: previewPoints, label: pointsLabel })}
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="1"
            defaultChecked={rule?.is_active ?? true}
            className="rounded border-slate-300"
          />
          {t("rules.form.active")}
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" className="h-9" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" className="h-9" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

function RewardDialog({
  open,
  onClose,
  reward,
  services,
  pointsLabel,
}: {
  open: boolean;
  onClose: () => void;
  reward: LoyaltyReward | null;
  services: ServiceOption[];
  pointsLabel: string;
}) {
  const t = useTranslations("institut.marketing.loyalty");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveLoyaltyReward, initial);
  const [rewardType, setRewardType] = useState<LoyaltyRewardType>(
    reward?.reward_type ?? "discount_percent",
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    if (open) setRewardType(reward?.reward_type ?? "discount_percent");
  }, [open, reward]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={reward ? t("rewards.editTitle") : t("rewards.createTitle")}
      size="lg"
    >
      <form action={action} className="space-y-4">
        {reward ? <input type="hidden" name="id" value={reward.id} /> : null}
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <Field label={t("rewards.form.name")} htmlFor="reward_name">
          <Input id="reward_name" name="name" defaultValue={reward?.name ?? ""} required />
        </Field>

        <Field label={t("rewards.form.description")} htmlFor="reward_description">
          <Input
            id="reward_description"
            name="description"
            defaultValue={reward?.description ?? ""}
          />
        </Field>

        <Field label={t("rewards.form.type")} htmlFor="reward_type">
          <Select
            id="reward_type"
            name="reward_type"
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value as LoyaltyRewardType)}
          >
            <option value="discount_percent">{t("rewards.types.discountPercentLabel")}</option>
            <option value="discount_fixed">{t("rewards.types.discountFixedLabel")}</option>
            <option value="free_service">{t("rewards.types.freeServiceLabel")}</option>
          </Select>
        </Field>

        <Field label={t("rewards.form.pointsCost", { label: pointsLabel })} htmlFor="reward_points">
          <Input
            id="reward_points"
            name="points_cost"
            type="number"
            min={1}
            defaultValue={reward?.points_cost ?? 100}
            required
          />
        </Field>

        {rewardType === "discount_percent" ? (
          <Field label={t("rewards.form.discountPercent")} htmlFor="reward_discount_percent">
            <Input
              id="reward_discount_percent"
              name="discount_percent"
              type="number"
              min={1}
              max={100}
              defaultValue={reward?.discount_percent ?? 10}
              required
            />
          </Field>
        ) : null}

        {rewardType === "discount_fixed" ? (
          <Field label={t("rewards.form.discountEur")} htmlFor="reward_discount_eur">
            <Input
              id="reward_discount_eur"
              name="discount_eur"
              type="number"
              min={0.01}
              step={0.01}
              defaultValue={(reward?.discount_cents ?? 1000) / 100}
              required
            />
          </Field>
        ) : null}

        {rewardType === "free_service" ? (
          <Field label={t("rewards.form.service")} htmlFor="reward_service">
            <Select
              id="reward_service"
              name="service_id"
              defaultValue={reward?.service_id ?? ""}
              required
            >
              <option value="">{tCommon("choose")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="1"
            defaultChecked={reward?.is_active ?? true}
            className="rounded border-slate-300"
          />
          {t("rewards.form.active")}
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" className="h-9" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" className="h-9" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
