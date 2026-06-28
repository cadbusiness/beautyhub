"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createService, updateService, type ActionResult } from "../actions";
import { uploadServiceImage } from "./image-actions";
import type { ServiceExtraLinkInput } from "@/lib/institut/service-extras-persist";
import {
  ServiceExtrasEditor,
  type ExtrasStepPosition,
} from "./service-extras-editor";
import { ServiceImageField } from "@/components/institut/service-image-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  currency: string;
  color: string | null;
  is_active: boolean;
  visibility: string;
  image_url: string | null;
  extras_step_position: string;
  buffer_before_min: number;
  buffer_after_min: number;
  min_advance_hours: number;
  max_advance_days: number;
};

type Tab = "general" | "time" | "advanced" | "extras";

const initial: ActionResult = {};

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-4", !active && "hidden")} aria-hidden={!active}>
      {children}
    </div>
  );
}

function ServiceStepNav({
  steps,
  current,
  onChange,
  navLabel,
  navHint,
}: {
  steps: { id: Tab; label: string }[];
  current: Tab;
  onChange: (id: Tab) => void;
  navLabel: string;
  navHint: string;
}) {
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <nav aria-label={navLabel} className="border-b border-slate-200 px-4 py-3">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const isActive = step.id === current;
          const isPast = i < currentIndex;

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start">
              <button
                type="button"
                onClick={() => onChange(step.id)}
                aria-current={isActive ? "step" : undefined}
                className="group flex w-full flex-col items-center gap-1.5 px-1"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    isActive && "bg-slate-900 text-white ring-4 ring-slate-900/10",
                    !isActive &&
                      isPast &&
                      "bg-slate-900 text-white group-hover:bg-slate-800",
                    !isActive &&
                      !isPast &&
                      "border-2 border-slate-300 text-slate-500 group-hover:border-slate-400 group-hover:text-slate-700",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-xs leading-tight font-medium",
                    isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700",
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <div
                  aria-hidden
                  className={cn(
                    "mt-4 h-0.5 min-w-[8px] flex-1 rounded-full",
                    i < currentIndex ? "bg-slate-900" : "bg-slate-200",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-slate-400">{navHint}</p>
    </nav>
  );
}

export function ServiceDialog({
  open,
  service,
  allServices,
  onClose,
}: {
  open: boolean;
  service: ServiceRow | null;
  allServices: ServiceRow[];
  onClose: () => void;
}) {
  const t = useTranslations("institut.services.dialog");
  const tCommon = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [extraLinks, setExtraLinks] = useState<ServiceExtraLinkInput[]>([]);
  const [extrasStepPosition, setExtrasStepPosition] = useState<ExtrasStepPosition>("after_time");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const isEdit = Boolean(service);

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("tabs.general") },
    { id: "time", label: t("tabs.time") },
    { id: "advanced", label: t("tabs.advanced") },
    { id: "extras", label: t("tabs.extras") },
  ];

  const action = isEdit ? updateService : createService;
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTab("general");
      setExtraLinks([]);
      setExtrasStepPosition(
        service?.extras_step_position === "before_time" ? "before_time" : "after_time",
      );
      setPendingImage(null);
      setStepError(null);
    }
    if (!open && dialog.open) dialog.close();
  }, [open, service?.extras_step_position]);

  useEffect(() => {
    if (!state.ok) return;

    async function finish() {
      if (!isEdit && state.serviceId && pendingImage) {
        const fd = new FormData();
        fd.set("file", pendingImage);
        await uploadServiceImage(state.serviceId, fd);
      }
      formRef.current?.reset();
      setPendingImage(null);
      onClose();
    }

    void finish();
  }, [state.ok, state.serviceId, isEdit, pendingImage, onClose]);

  function goToStep(next: Tab) {
    setStepError(null);
    setTab(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const name = (formRef.current?.elements.namedItem("name") as HTMLInputElement)?.value.trim();
    const duration = Number.parseInt(
      (formRef.current?.elements.namedItem("duration_min") as HTMLInputElement)?.value ?? "0",
      10,
    );

    if (!name) {
      e.preventDefault();
      setStepError(t("wizard.nameRequired"));
      setTab("general");
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      e.preventDefault();
      setStepError(t("wizard.durationRequired"));
      setTab("time");
      return;
    }
    setStepError(null);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto w-[min(100vw-2rem,560px)] max-h-[min(90vh,780px)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="flex max-h-[min(90vh,780px)] flex-col"
      >
        {service ? <input type="hidden" name="id" value={service.id} /> : null}
        <input type="hidden" name="extras_links_json" value={JSON.stringify(extraLinks)} />
        <input type="hidden" name="extras_step_position" value={extrasStepPosition} />

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? t("editTitle") : t("createTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tCommon("close")}
          >
            ✕
          </button>
        </div>

        {isEdit ? (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-5">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goToStep(item.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === item.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <ServiceStepNav
            steps={tabs}
            current={tab}
            onChange={goToStep}
            navLabel={t("wizard.navLabel")}
            navHint={t("wizard.navHint")}
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!isEdit ? (
            <p className="mb-4 text-sm font-medium text-slate-900">
              {tabs.find((item) => item.id === tab)?.label}
            </p>
          ) : null}
          <TabPanel active={tab === "general"}>
            <Field label={tCommon("name")} htmlFor="name">
              <Input
                id="name"
                name="name"
                required
                placeholder={t("namePlaceholder")}
                defaultValue={service?.name ?? ""}
              />
            </Field>

            <div className="grid grid-cols-[72px_1fr] gap-4">
              <Field label={tCommon("color")} htmlFor="color">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  className="h-10 cursor-pointer p-1"
                  defaultValue={service?.color ?? "#64748b"}
                />
              </Field>
              <Field label={t("priceEur")} htmlFor="price">
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={service ? centsToEuros(service.price_cents) : "0"}
                />
              </Field>
            </div>

            <Field label={tCommon("description")} htmlFor="description">
              <Textarea
                id="description"
                name="description"
                placeholder={t("descriptionPlaceholder")}
                defaultValue={service?.description ?? ""}
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={service?.is_active ?? true}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{t("visibleLabel")}</span>
                <span className="text-xs text-slate-500">{t("visibleHint")}</span>
              </span>
            </label>

            <Field label={t("visibility")} htmlFor="visibility">
              <select
                id="visibility"
                name="visibility"
                defaultValue={service?.visibility ?? "catalog"}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="catalog">{t("visibilityCatalog")}</option>
                <option value="extra_only">{t("visibilityExtraOnly")}</option>
              </select>
            </Field>

            <Field label={t("imageLabel")} htmlFor="service_image">
              <ServiceImageField
                serviceId={service?.id}
                initialUrl={service?.image_url}
                onPendingFile={setPendingImage}
              />
            </Field>
          </TabPanel>

          <TabPanel active={tab === "time"}>
            <Field label={t("durationMin")} htmlFor="duration_min">
              <Input
                id="duration_min"
                name="duration_min"
                type="number"
                min={1}
                defaultValue={service?.duration_min ?? 30}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("bufferBefore")} htmlFor="buffer_before_min">
                <Input
                  id="buffer_before_min"
                  name="buffer_before_min"
                  type="number"
                  min={0}
                  defaultValue={service?.buffer_before_min ?? 0}
                />
              </Field>
              <Field label={t("bufferAfter")} htmlFor="buffer_after_min">
                <Input
                  id="buffer_after_min"
                  name="buffer_after_min"
                  type="number"
                  min={0}
                  defaultValue={service?.buffer_after_min ?? 0}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t("bufferHint")}</p>
          </TabPanel>

          <TabPanel active={tab === "advanced"}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("minAdvanceHours")} htmlFor="min_advance_hours">
                <Input
                  id="min_advance_hours"
                  name="min_advance_hours"
                  type="number"
                  min={0}
                  defaultValue={service?.min_advance_hours ?? 0}
                />
              </Field>
              <Field label={t("maxAdvanceDays")} htmlFor="max_advance_days">
                <Input
                  id="max_advance_days"
                  name="max_advance_days"
                  type="number"
                  min={1}
                  defaultValue={service?.max_advance_days ?? 60}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t("bookingWindowHint")}</p>
          </TabPanel>

          <TabPanel active={tab === "extras"}>
            <ServiceExtrasEditor
              serviceId={isEdit ? service?.id : undefined}
              candidateServices={allServices}
              links={extraLinks}
              onLinksChange={setExtraLinks}
              stepPosition={extrasStepPosition}
              onStepPositionChange={setExtrasStepPosition}
              showSaveButton={isEdit}
            />
          </TabPanel>

          {stepError ? <p className="mt-2 text-sm text-red-600">{stepError}</p> : null}
          {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? t("submitting")
              : isEdit
                ? t("editSubmit")
                : t("createSubmit")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
