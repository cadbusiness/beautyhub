"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createAppointment,
  updateAppointment,
  type ActionResult,
} from "../actions";
import { loadInstServiceExtras } from "../prestations/extras-actions";
import { QuickServiceForm } from "../prestations/quick-service-form";
import { ExtrasPicker } from "@/components/institut/extras-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  extrasToJson,
  type BookingExtraLine,
  type ServiceExtraConfig,
} from "@/lib/institut/service-extras";
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

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentForm({
  mode = "create",
  appointment,
  clients,
  services,
  staff,
  resources = [],
  onSuccess,
}: {
  mode?: "create" | "edit";
  appointment?: CalendarAppointment;
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
  const [serviceId, setServiceId] = useState(appointment?.service_id ?? "");
  const [extraCatalog, setExtraCatalog] = useState<ServiceExtraConfig[]>([]);
  const [extras, setExtras] = useState<BookingExtraLine[]>([]);
  const [showQuickService, setShowQuickService] = useState(services.length === 0);
  const [, startLoadExtras] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const selectedService = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceId) {
      setExtraCatalog([]);
      setExtras([]);
      return;
    }
    startLoadExtras(async () => {
      const catalog = await loadInstServiceExtras(serviceId);
      setExtraCatalog(catalog);
      if (mode === "edit" && appointment?.extras?.length) {
        setExtras(
          appointment.extras.map((e) => ({
            service_id: e.service_id,
            quantity: e.quantity,
          })),
        );
      } else {
        setExtras([]);
      }
    });
  }, [serviceId, mode, appointment?.extras]);

  useEffect(() => {
    if (state.ok) {
      if (mode === "create") formRef.current?.reset();
      setIgnoreSchedule(false);
      setExtras([]);
      onSuccess?.();
    }
  }, [state.ok, onSuccess, mode]);

  useEffect(() => {
    if (state.warning && !state.ok) {
      setIgnoreSchedule(false);
    }
  }, [state.warning, state.ok]);

  const showScheduleWarning = Boolean(state.warning && !state.ok && !ignoreSchedule);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {mode === "edit" && appointment ? (
        <input type="hidden" name="id" value={appointment.id} />
      ) : null}
      <input type="hidden" name="ignore_schedule" value={ignoreSchedule ? "1" : "0"} />
      <input type="hidden" name="extras_json" value={extrasToJson(extras)} />

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
      <Field label={t("service")} htmlFor="service_id">
        {services.length === 0 ? (
          <p className="mb-2 text-sm text-slate-600">{t("noServicesHint")}</p>
        ) : (
          <Select
            id="service_id"
            name="service_id"
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
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
        {services.length > 0 && !showQuickService ? (
          <button
            type="button"
            className="mt-1 text-xs text-slate-500 underline hover:text-slate-800"
            onClick={() => setShowQuickService(true)}
          >
            + {t("addService")}
          </button>
        ) : null}
      </Field>

      {showQuickService || services.length === 0 ? (
        <QuickServiceForm
          compact
          onCreated={(id) => {
            setServiceId(id);
            setShowQuickService(false);
          }}
        />
      ) : null}

      {serviceId && services.length === 0 ? (
        <input type="hidden" name="service_id" value={serviceId} />
      ) : null}

      {selectedService && extraCatalog.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">{t("extras")}</p>
          <ExtrasPicker
            catalog={extraCatalog}
            baseDurationMin={selectedService.duration_min ?? 30}
            basePriceCents={selectedService.price_cents ?? 0}
            value={extras}
            onChange={setExtras}
          />
        </div>
      ) : null}

      <Field label={t("staff")} htmlFor="staff_id">
        <Select
          id="staff_id"
          name="staff_id"
          defaultValue={appointment?.staff_id ?? ""}
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
        <Field label={t("resource")} htmlFor="resource_id">
          <Select
            id="resource_id"
            name="resource_id"
            defaultValue={appointment?.resource_id ?? ""}
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
      <Field label={t("startsAt")} htmlFor="starts_at">
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={
            appointment ? toDatetimeLocal(appointment.starts_at) : undefined
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

      <Button type="submit" disabled={pending || !serviceId}>
        {pending
          ? tCommon("saving")
          : mode === "edit"
            ? tCommon("save")
            : t("create")}
      </Button>
    </form>
  );
}
