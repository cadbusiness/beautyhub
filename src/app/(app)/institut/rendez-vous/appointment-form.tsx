"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  cancelAppointment,
  createAppointment,
  updateAppointment,
  type ActionResult,
} from "../actions";
import { QuickServiceForm } from "../prestations/quick-service-form";
import { ServiceExtrasField } from "@/components/institut/service-extras-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  extrasToJson,
  type BookingExtraLine,
} from "@/lib/institut/service-extras";
import {
  defaultUntilDate,
  type RecurrenceFrequency,
} from "@/lib/institut/appointment-recurrence";
import type { CalendarAppointment } from "./calendar/types";

const initial: ActionResult = {};

const STATUS_KEYS = [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

interface ServiceOption {
  id: string;
  label: string;
  duration_min?: number;
  price_cents?: number;
}

interface Option {
  id: string;
  label: string;
}

type FormLine = {
  key: string;
  serviceId: string;
  extras: BookingExtraLine[];
  staffId: string;
  resourceId: string;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newLineKey() {
  return crypto.randomUUID();
}

function emptyLine(draft?: { staffId?: string | null; resourceId?: string | null }): FormLine {
  return {
    key: newLineKey(),
    serviceId: "",
    extras: [],
    staffId: draft?.staffId ?? "",
    resourceId: draft?.resourceId ?? "",
  };
}

export function AppointmentForm({
  mode = "create",
  appointment,
  draft,
  clients,
  services,
  staff,
  resources = [],
  onSuccess,
}: {
  mode?: "create" | "edit";
  appointment?: CalendarAppointment;
  draft?: {
    startsAt?: string;
    staffId?: string | null;
    resourceId?: string | null;
  };
  clients: Option[];
  services: ServiceOption[];
  staff: Option[];
  resources?: Option[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("appointments.form");
  const tStatus = useTranslations("appointments.status");
  const tCommon = useTranslations("common");
  const actionFn = mode === "edit" ? updateAppointment : createAppointment;
  const [state, action, pending] = useActionState(actionFn, initial);
  const [ignoreSchedule, setIgnoreSchedule] = useState(false);
  const [showQuickService, setShowQuickService] = useState(services.length === 0);
  const [lines, setLines] = useState<FormLine[]>(() => {
    if (mode === "edit" && appointment) {
      return [
        {
          key: appointment.id,
          serviceId: appointment.service_id ?? "",
          extras: (appointment.extras ?? []).map((e) => ({
            service_id: e.service_id,
            quantity: e.quantity,
          })),
          staffId: appointment.staff_id ?? "",
          resourceId: appointment.resource_id ?? "",
        },
      ];
    }
    return [emptyLine(draft)];
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [, startCancelSeries] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const primaryLine = lines[0];
  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines
          .filter((line) => line.serviceId)
          .map((line) => ({
            service_id: line.serviceId,
            extras: line.extras,
            staff_id: line.staffId || null,
            resource_id: line.resourceId || null,
          })),
      ),
    [lines],
  );

  useEffect(() => {
    if (state.ok) {
      if (mode === "create") {
        formRef.current?.reset();
        setLines([emptyLine(draft)]);
        setRecurrence("none");
        setRecurrenceUntil("");
      }
      setIgnoreSchedule(false);
      onSuccess?.();
    }
  }, [state.ok, onSuccess, mode, draft]);

  useEffect(() => {
    if (state.warning && !state.ok) {
      setIgnoreSchedule(false);
    }
  }, [state.warning, state.ok]);

  useEffect(() => {
    if (recurrence === "none") {
      setRecurrenceUntil("");
      return;
    }
    const startsRaw = formRef.current
      ? String(new FormData(formRef.current).get("starts_at") ?? "")
      : "";
    const from = startsRaw ? new Date(startsRaw) : draft?.startsAt ? new Date(draft.startsAt) : new Date();
    if (Number.isNaN(from.getTime())) return;
    setRecurrenceUntil((prev) => prev || defaultUntilDate(from, recurrence));
  }, [recurrence, draft?.startsAt]);

  const showScheduleWarning = Boolean(state.warning && !state.ok && !ignoreSchedule);
  const canSubmit = lines.some((line) => line.serviceId);
  const multiple = lines.filter((line) => line.serviceId).length > 1 || recurrence !== "none";

  function updateLine(key: string, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const last = lines[lines.length - 1];
    setLines((prev) => [
      ...prev,
      {
        ...emptyLine(),
        staffId: last?.staffId ?? draft?.staffId ?? "",
        resourceId: last?.resourceId ?? draft?.resourceId ?? "",
      },
    ]);
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {mode === "edit" && appointment ? (
        <input type="hidden" name="id" value={appointment.id} />
      ) : null}
      <input type="hidden" name="ignore_schedule" value={ignoreSchedule ? "1" : "0"} />
      {mode === "create" ? (
        <>
          <input type="hidden" name="lines_json" value={linesJson} />
          <input type="hidden" name="recurrence_frequency" value={recurrence} />
        </>
      ) : (
        <>
          <input type="hidden" name="service_id" value={primaryLine?.serviceId ?? ""} />
          <input type="hidden" name="staff_id" value={primaryLine?.staffId ?? ""} />
          <input type="hidden" name="resource_id" value={primaryLine?.resourceId ?? ""} />
          <input type="hidden" name="extras_json" value={extrasToJson(primaryLine?.extras ?? [])} />
        </>
      )}

      <Field label={t("client")} htmlFor="client_id">
        <Select
          id="client_id"
          name="client_id"
          defaultValue={appointment?.client_id ?? ""}
        >
          <option value="">{t("noClient")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t("startsAt")} htmlFor="starts_at">
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={
            appointment
              ? toDatetimeLocal(appointment.starts_at)
              : draft?.startsAt
                ? toDatetimeLocal(draft.startsAt)
                : undefined
          }
        />
      </Field>

      {mode === "edit" ? (
        <Field label={t("endsAt")} htmlFor="ends_at">
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={
              appointment ? toDatetimeLocal(appointment.ends_at) : undefined
            }
          />
          <p className="mt-1 text-xs text-slate-500">{t("endsAtExtrasHint")}</p>
        </Field>
      ) : null}

      <div className="space-y-3">
        {lines.map((line, index) => {
          const selectedService = services.find((s) => s.id === line.serviceId);
          return (
            <div
              key={line.key}
              className="space-y-3 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {t("lineLabel", { n: index + 1 })}
                </p>
                {mode === "create" && lines.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-slate-500 underline hover:text-slate-800"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    {t("removeLine")}
                  </button>
                ) : null}
              </div>

              <Field label={t("service")} htmlFor={`service_id_${line.key}`}>
                {services.length === 0 ? (
                  <p className="mb-2 text-sm text-slate-600">{t("noServicesHint")}</p>
                ) : (
                  <Select
                    id={`service_id_${line.key}`}
                    required={index === 0}
                    value={line.serviceId}
                    onChange={(e) =>
                      updateLine(line.key, { serviceId: e.target.value, extras: [] })
                    }
                  >
                    <option value="" disabled>
                      {t("chooseService")}
                    </option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                )}
                {index === 0 && services.length > 0 && !showQuickService ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-slate-500 underline hover:text-slate-800"
                    onClick={() => setShowQuickService(true)}
                  >
                    + {t("addService")}
                  </button>
                ) : null}
              </Field>

              {index === 0 && (showQuickService || services.length === 0) ? (
                <QuickServiceForm
                  compact
                  refreshOnCreate
                  onCreated={(id) => {
                    updateLine(line.key, { serviceId: id, extras: [] });
                    setShowQuickService(false);
                  }}
                />
              ) : null}

              {line.serviceId ? (
                <ServiceExtrasField
                  serviceId={line.serviceId}
                  baseDurationMin={selectedService?.duration_min ?? 30}
                  basePriceCents={selectedService?.price_cents ?? 0}
                  value={line.extras}
                  onChange={(extras) => updateLine(line.key, { extras })}
                  seedFromCatalog={mode === "create"}
                  compact={lines.length > 1}
                />
              ) : null}

              <Field label={t("staff")} htmlFor={`staff_id_${line.key}`}>
                <Select
                  id={`staff_id_${line.key}`}
                  value={line.staffId}
                  onChange={(e) => updateLine(line.key, { staffId: e.target.value })}
                >
                  <option value="">{t("anyStaff")}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {resources.length > 0 ? (
                <Field label={t("resource")} htmlFor={`resource_id_${line.key}`}>
                  <Select
                    id={`resource_id_${line.key}`}
                    value={line.resourceId}
                    onChange={(e) => updateLine(line.key, { resourceId: e.target.value })}
                  >
                    <option value="">{t("noResource")}</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          );
        })}

        {mode === "create" ? (
          <button
            type="button"
            className="text-sm text-slate-600 underline hover:text-slate-900"
            onClick={addLine}
          >
            + {t("addLine")}
          </button>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <Field label={t("recurrence")} htmlFor="recurrence_frequency_ui">
            <Select
              id="recurrence_frequency_ui"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency)}
            >
              <option value="none">{t("recurrenceNone")}</option>
              <option value="weekly">{t("recurrenceWeekly")}</option>
              <option value="biweekly">{t("recurrenceBiweekly")}</option>
              <option value="monthly">{t("recurrenceMonthly")}</option>
            </Select>
          </Field>
          {recurrence !== "none" ? (
            <>
              <Field label={t("recurrenceUntil")} htmlFor="recurrence_until">
                <Input
                  id="recurrence_until"
                  name="recurrence_until"
                  type="date"
                  required
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                />
              </Field>
              <p className="text-xs text-slate-500">{t("recurrenceHint")}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "edit" && appointment ? (
        <Field label={t("status")} htmlFor="status">
          <Select id="status" name="status" defaultValue={appointment.status}>
            {STATUS_KEYS.map((value) => (
              <option key={value} value={value}>
                {tStatus(value)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={t("notes")} htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          placeholder={tCommon("optional")}
          defaultValue={appointment?.notes ?? ""}
        />
      </Field>

      {showScheduleWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{state.warning}</p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ignoreSchedule}
              onChange={(e) => setIgnoreSchedule(e.target.checked)}
            />
            <span>{t("scheduleWarningConfirm")}</span>
          </label>
        </div>
      ) : null}

      {state.error && !showScheduleWarning ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      {mode === "edit" && appointment?.series_id ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>{t("seriesHint")}</p>
          <button
            type="button"
            className="mt-2 text-xs text-red-600 underline hover:text-red-800"
            onClick={() => {
              if (!appointment) return;
              startCancelSeries(async () => {
                const fd = new FormData();
                fd.set("id", appointment.id);
                fd.set("cancel_scope", "future");
                await cancelAppointment(fd);
                onSuccess?.();
              });
            }}
          >
            {t("cancelSeriesFuture")}
          </button>
        </div>
      ) : null}

      {mode === "edit" && appointment && appointment.status !== "cancelled" ? (
        <Link
          href={`/institut/caisse?appointment=${appointment.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          {t("checkout")}
        </Link>
      ) : null}

      <Button type="submit" disabled={pending || !canSubmit}>
        {pending
          ? tCommon("saving")
          : mode === "edit"
            ? tCommon("save")
            : multiple
              ? t("createMultiple")
              : t("create")}
      </Button>
      {mode === "create" && multiple ? (
        <p className="text-xs text-slate-500">{t("createMultipleHint")}</p>
      ) : null}
    </form>
  );
}
