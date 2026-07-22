"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, CopyPlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  applyLoyaltyStarterPack,
  createLoyaltyProgram,
  deleteLoyaltyEarnRule,
  deleteLoyaltyReward,
  duplicateLoyaltyProgram,
  saveLoyaltyEarnRule,
  saveLoyaltyProgramSettings,
  saveLoyaltyReward,
  setLoyaltyProgramActive,
  type ActionResult,
} from "./loyalty-actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PageTabs } from "@/components/ui/page-tabs";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { cn, formatPrice } from "@/lib/utils";
import {
  calcPointsForRule,
  defaultCalcModeForSource,
  type LoyaltyCalcMode,
  type LoyaltyEarnRule,
  type LoyaltyIntegrations,
  type LoyaltyProgramListItem,
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

function ProgramPicker({
  programs,
  selectedId,
  label,
  onSelect,
}: {
  programs: LoyaltyProgramListItem[];
  selectedId: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = programs.find((p) => p.id === selectedId) ?? programs[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        id="loyalty_program_picker"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md py-1 pl-1.5 pr-1 text-left transition-colors",
          "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
          open && "bg-slate-100",
        )}
      >
        <span className="truncate text-sm font-medium text-slate-900">{selected?.name}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby="loyalty_program_picker"
          className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] max-w-[min(100vw-2rem,20rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {programs.map((p) => {
            const isSelected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setOpen(false);
                  if (p.id !== selectedId) onSelect(p.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-slate-50 font-medium text-slate-900"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmptyRow({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <tr>
      <td colSpan={5} className={dataTableCell}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <span className="text-slate-500">{message}</span>
          <Button type="button" onClick={onAction} className="h-8 shrink-0">
            + {actionLabel}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StarterPackButton({ label, programId }: { label: string; programId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await applyLoyaltyStarterPack(programId);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}


export function LoyaltyManager({
  snapshot,
  integrations,
  services,
  selectedProgramId,
}: {
  snapshot: LoyaltyProgramSnapshot;
  integrations: LoyaltyIntegrations;
  services: ServiceOption[];
  selectedProgramId: string;
}) {
  const t = useTranslations("institut.marketing.loyalty");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [programState, programAction, programPending] = useActionState(
    saveLoyaltyProgramSettings,
    initial,
  );
  const [programCreateState, programCreateAction, programCreatePending] = useActionState(
    createLoyaltyProgram,
    initial,
  );
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [section, setSection] = useState<"rules" | "rewards" | "program">("rules");
  const [editingRule, setEditingRule] = useState<LoyaltyEarnRule | null>(null);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [pendingDelete, startDelete] = useTransition();
  const [duplicatePending, startDuplicate] = useTransition();
  const [activePending, startActive] = useTransition();

  const { program, rules, rewards } = snapshot;

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

  useEffect(() => {
    if (!programCreateState.ok || !programCreateState.createdProgramId) return;
    router.replace(`${pathname}?program=${programCreateState.createdProgramId}`);
  }, [programCreateState.ok, programCreateState.createdProgramId, pathname, router]);

  function handleDuplicateProgramSubmit(formData: FormData) {
    setDuplicateError(null);
    startDuplicate(async () => {
      const result = await duplicateLoyaltyProgram(formData);
      if (!result.ok || !result.createdProgramId) {
        setDuplicateError(result.error ?? t("actions.invalidRule"));
        return;
      }
      setDuplicateDialogOpen(false);
      router.replace(`${pathname}?program=${result.createdProgramId}`);
    });
  }

  function handleSetActive(nextActive: boolean) {
    startActive(async () => {
      await setLoyaltyProgramActive(snapshot.program.id, nextActive);
      router.refresh();
    });
  }

  return (
    <>
      <ListToolbar
        action={
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDuplicateDialogOpen(true)}
              className="h-9 w-full sm:w-auto"
            >
              <CopyPlus className="h-4 w-4" />
              {t("program.duplicateProgram")}
            </Button>
            <Button type="button" onClick={() => setProgramDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + {t("program.newProgram")}
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ProgramPicker
            programs={snapshot.programs}
            selectedId={selectedProgramId}
            label={t("program.selectorLabel")}
            onSelect={(id) => router.replace(`${pathname}?program=${id}`)}
          />
          <ProgramStatusBadge status={programStatus} label={t(`programStatus.${programStatus}`)} />
          {programStatus === "ready" ? (
            <button
              type="button"
              disabled={activePending}
              onClick={() => handleSetActive(true)}
              className="shrink-0 text-xs font-medium text-amber-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {activePending ? "…" : t("program.activate")}
            </button>
          ) : null}
          {programStatus === "live" ? (
            <button
              type="button"
              disabled={activePending}
              onClick={() => handleSetActive(false)}
              className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
            >
              {activePending ? "…" : t("program.deactivate")}
            </button>
          ) : null}
        </div>
      </ListToolbar>

      <PageTabs
        tabs={[
          { id: "rules", label: t("rules.title"), count: rules.length || undefined },
          { id: "rewards", label: t("rewards.title"), count: rewards.length || undefined },
          { id: "program", label: t("program.title") },
        ]}
        active={section}
        onChange={(value) => setSection(value as "rules" | "rewards" | "program")}
      />

      {section === "rules" ? (
        <>
      {!hasRules ? (
        <div className="flex justify-end border-b border-slate-200 px-4 py-2 lg:px-6">
          <StarterPackButton label={t("starterPack")} programId={snapshot.program.id} />
        </div>
      ) : null}
      <ListToolbar
        action={
          <Button onClick={openCreateRule} className="h-9 w-full sm:w-auto">
            + {t("rules.add")}
          </Button>
        }
      >
        <div>
          <p className="text-sm font-medium text-slate-700">{t("rules.title")}</p>
          <p className="text-xs text-slate-500">{t("rules.hint")}</p>
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
              <EmptyRow
                message={t("rules.empty")}
                actionLabel={t("rules.add")}
                onAction={openCreateRule}
              />
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
                    <RowActions className="justify-start">
                      <RowActionButton
                        type="button"
                        onClick={() => openEditRule(rule)}
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        {tCommon("edit")}
                      </RowActionButton>
                      <RowActionButton
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={pendingDelete}
                        tone="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        {tCommon("delete")}
                      </RowActionButton>
                    </RowActions>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTable>
      {rules.length > 0 ? (
        <ListPanelFooter>{t("rules.footer", { count: rules.length })}</ListPanelFooter>
      ) : null}
      </>
      ) : null}

      {section === "rewards" ? (
        <>
          <ListToolbar
            action={
              <Button onClick={openCreateReward} className="h-9 w-full sm:w-auto">
                + {t("rewards.add")}
              </Button>
            }
          >
            <div>
              <p className="text-sm font-medium text-slate-700">{t("rewards.title")}</p>
              <p className="text-xs text-slate-500">{t("rewards.hint")}</p>
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
                  <EmptyRow
                    message={t("rewards.empty")}
                    actionLabel={t("rewards.add")}
                    onAction={openCreateReward}
                  />
                ) : (
                  rewards.map((reward) => (
                    <tr key={reward.id} className={dataTableRow}>
                      <td className={`${dataTableCell} font-medium text-slate-900`}>
                        {reward.name}
                      </td>
                      <td className={dataTableCell}>
                        {formatRewardType(reward, services, t)}
                        {reward.new_service_only ? (
                          <span className="ml-1.5 text-xs text-violet-600">
                            ({t("rewards.newServiceOnlyShort")})
                          </span>
                        ) : null}
                      </td>
                      <td className={dataTableCell}>
                        {reward.points_cost} {program.points_label}
                      </td>
                      <td className={dataTableCell}>
                        {reward.is_active ? t("status.active") : t("status.inactive")}
                      </td>
                      <td className={dataTableCell}>
                        <RowActions className="justify-start">
                          <RowActionButton
                            type="button"
                            onClick={() => openEditReward(reward)}
                            icon={<Pencil className="h-3.5 w-3.5" />}
                          >
                            {tCommon("edit")}
                          </RowActionButton>
                          <RowActionButton
                            type="button"
                            onClick={() => handleDeleteReward(reward.id)}
                            disabled={pendingDelete}
                            tone="danger"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            {tCommon("delete")}
                          </RowActionButton>
                        </RowActions>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTable>
          {rewards.length > 0 ? (
            <ListPanelFooter>{t("rewards.footer", { count: rewards.length })}</ListPanelFooter>
          ) : null}
        </>
      ) : null}

      {section === "program" ? (
        <>
          <div className="border-t border-slate-200 px-4 py-3 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-700">{t("program.title")}</p>
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {t("program.scopeBadge")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t("program.globalHint")}</p>
          </div>
          <form
            action={programAction}
            className={cn(
              "space-y-4 border-t border-slate-200 px-4 py-4 lg:px-6",
              "bg-slate-50/50",
            )}
          >
            <input type="hidden" name="program_id" value={snapshot.program.id} />
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
                <div className="space-y-1">
                  <Input
                    id="loyalty_points_label"
                    name="points_label"
                    defaultValue={program.points_label}
                    required
                  />
                  <p className="text-xs text-slate-500">{t("program.pointsLabelHint")}</p>
                </div>
              </Field>
              <Field label={t("program.birthdayBonus")} htmlFor="loyalty_birthday_bonus">
                <Input
                  id="loyalty_birthday_bonus"
                  name="birthday_bonus_points"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={program.birthday_bonus_points ?? 0}
                />
              </Field>
              <Field label={t("roadmap.referralPoints")} htmlFor="loyalty_referral_points">
                <Input
                  id="loyalty_referral_points"
                  name="referral_points"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={program.referral_points ?? 0}
                />
              </Field>
              <Field label={t("roadmap.rebookPoints")} htmlFor="loyalty_rebook_points">
                <Input
                  id="loyalty_rebook_points"
                  name="same_day_rebook_points"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={program.same_day_rebook_points ?? 0}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t("program.birthdayBonusHint")}</p>
            <p className="text-xs text-slate-500">{t("roadmap.hint")}</p>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="birthday_auto_enabled"
                value="1"
                defaultChecked={program.birthday_auto_enabled ?? false}
                className="rounded border-slate-300"
              />
              {t("program.birthdayAuto")}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="portal_visible"
                value="1"
                defaultChecked={program.portal_visible ?? true}
                className="rounded border-slate-300"
              />
              {t("program.portalVisible")}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                key={`is_active-${program.is_active ? "1" : "0"}`}
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
        </>
      ) : null}

      <EarnRuleDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        rule={editingRule}
        integrations={integrations}
        pointsLabel={program.points_label}
        programId={snapshot.program.id}
      />

      <RewardDialog
        open={rewardDialogOpen}
        onClose={() => setRewardDialogOpen(false)}
        reward={editingReward}
        services={services}
        pointsLabel={program.points_label}
        programId={snapshot.program.id}
      />

      <FormDialog
        open={programDialogOpen}
        onClose={() => setProgramDialogOpen(false)}
        title={t("program.newProgramTitle")}
      >
        <form action={programCreateAction} className="space-y-4">
          {programCreateState.error ? <p className="text-sm text-red-600">{programCreateState.error}</p> : null}
          <Field label={t("program.newProgramName")} htmlFor="new_program_name">
            <Input id="new_program_name" name="name" required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-9" onClick={() => setProgramDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="h-9" disabled={programCreatePending}>
              {programCreatePending ? tCommon("saving") : tCommon("save")}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={duplicateDialogOpen}
        onClose={() => {
          setDuplicateDialogOpen(false);
          setDuplicateError(null);
        }}
        title={t("program.duplicateProgramTitle")}
      >
        <form action={handleDuplicateProgramSubmit} className="space-y-4">
          <input type="hidden" name="source_program_id" value={snapshot.program.id} />
          {duplicateError ? <p className="text-sm text-red-600">{duplicateError}</p> : null}
          <Field label={t("program.duplicateProgramName")} htmlFor="duplicate_program_name">
            <Input
              id="duplicate_program_name"
              name="name"
              required
              defaultValue={`${snapshot.program.name} ${t("program.copySuffix")}`}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setDuplicateDialogOpen(false);
                setDuplicateError(null);
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="h-9" disabled={duplicatePending}>
              {duplicatePending ? tCommon("saving") : t("program.duplicateProgram")}
            </Button>
          </div>
        </form>
      </FormDialog>
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
  programId,
}: {
  open: boolean;
  onClose: () => void;
  rule: LoyaltyEarnRule | null;
  integrations: LoyaltyIntegrations;
  pointsLabel: string;
  programId: string;
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
        <input type="hidden" name="program_id" value={programId} />
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
  programId,
}: {
  open: boolean;
  onClose: () => void;
  reward: LoyaltyReward | null;
  services: ServiceOption[];
  pointsLabel: string;
  programId: string;
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
        <input type="hidden" name="program_id" value={programId} />
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
            name="new_service_only"
            value="1"
            defaultChecked={reward?.new_service_only ?? false}
            className="rounded border-slate-300"
          />
          {t("rewards.form.newServiceOnly")}
        </label>
        <p className="text-xs text-slate-500">{t("rewards.form.newServiceOnlyHint")}</p>

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
