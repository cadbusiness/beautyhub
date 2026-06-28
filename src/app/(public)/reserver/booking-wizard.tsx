"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { bookPublicAppointment } from "./actions";
import type { PublicService, PublicSlot, PublicStaff } from "@/lib/public/booking-load";
import { ExtrasPicker } from "@/components/institut/extras-picker";
import {
  AvailabilityPreferencesForm,
  defaultAvailability,
} from "@/components/booking/availability-preferences";
import { QuoteRequestForm } from "./quote-request-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";
import { totalDurationMin, totalPriceCents } from "@/lib/institut/service-extras";
import {
  groupSlotsByDate,
  type AvailabilityPreferences,
} from "@/lib/public/booking-availability";

type WizardStep = "service" | "quote" | "staff" | "extras" | "availability" | "slots" | "done";

async function fetchBookingStaff(serviceId: string): Promise<PublicStaff[]> {
  const res = await fetch(`/api/public/booking?serviceId=${encodeURIComponent(serviceId)}`);
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

async function fetchBookingExtras(serviceId: string): Promise<ServiceExtraConfig[]> {
  const res = await fetch(
    `/api/public/booking?serviceId=${encodeURIComponent(serviceId)}&kind=extras`,
  );
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

async function fetchBookingSlotsByAvailability(
  serviceId: string,
  staffId: string,
  extras: BookingExtraLine[],
  availability: AvailabilityPreferences,
): Promise<PublicSlot[]> {
  const params = new URLSearchParams({
    serviceId,
    staffId,
    fromDate: availability.fromDate,
    weekdays: availability.weekdays.join(","),
    timeFrom: availability.timeFrom,
    timeTo: availability.timeTo,
  });
  if (extras.length > 0) params.set("extras", JSON.stringify(extras));
  const res = await fetch(`/api/public/booking?${params}`);
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

export function BookingWizard({
  initialServiceId = "",
  services,
}: {
  initialServiceId?: string;
  services: PublicService[];
}) {
  const t = useTranslations("public.booking");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [step, setStep] = useState<WizardStep>("service");
  const [staff, setStaff] = useState<PublicStaff[]>([]);
  const [extraCatalog, setExtraCatalog] = useState<ServiceExtraConfig[]>([]);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [staffId, setStaffId] = useState("");
  const [availability, setAvailability] = useState<AvailabilityPreferences>(defaultAvailability);
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [extras, setExtras] = useState<BookingExtraLine[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deepLinked = useRef(false);

  useEffect(() => {
    if (!initialServiceId || deepLinked.current) return;
    if (!services.some((s) => s.id === initialServiceId)) return;
    deepLinked.current = true;
    pickService(initialServiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep link once on mount
  }, [initialServiceId, services]);

  const selectedService = services.find((s) => s.id === serviceId);
  const extrasBeforeTime = selectedService?.extras_step_position === "before_time";
  const hasExtras = extraCatalog.length > 0;

  const stepLabels = useMemo(() => {
    const labels = [t("steps.service"), t("steps.staff")];
    if (hasExtras) labels.push(t("steps.extras"));
    labels.push(t("steps.availability"), t("steps.slots"));
    return labels;
  }, [hasExtras, t]);

  const stepIndex = useMemo(() => {
    const order: WizardStep[] = ["service", "staff"];
    if (hasExtras) order.push("extras");
    order.push("availability", "slots");
    const idx = order.indexOf(step === "done" ? "slots" : step);
    return idx >= 0 ? idx + 1 : 1;
  }, [hasExtras, step]);

  function pickService(id: string) {
    setServiceId(id);
    setStaffId("");
    setSlot(null);
    setExtras([]);
    const service = services.find((s) => s.id === id);
    if (service && (service.booking_mode === "quote" || service.booking_mode === "manual")) {
      setStep("quote");
      return;
    }
    startTransition(async () => {
      try {
        const [staffList, catalog] = await Promise.all([
          fetchBookingStaff(id),
          fetchBookingExtras(id),
        ]);
        setStaff(staffList);
        setExtraCatalog(catalog);
        setStep("staff");
      } catch {
        setError(t("loadError"));
      }
    });
  }

  function pickStaff(id: string) {
    setStaffId(id);
    if (hasExtras && extrasBeforeTime) setStep("extras");
    else setStep("availability");
  }

  function loadSlots() {
    if (!serviceId || !staffId) return;
    const slotExtras = extrasBeforeTime ? extras : [];
    startTransition(async () => {
      try {
        const list = await fetchBookingSlotsByAvailability(
          serviceId,
          staffId,
          slotExtras,
          availability,
        );
        setSlots(list);
        setSlot(null);
        setStep("slots");
      } catch {
        setError(t("loadError"));
      }
    });
  }

  function pickSlot(sl: PublicSlot) {
    setSlot(sl);
    if (hasExtras && !extrasBeforeTime) setStep("extras");
  }

  function confirmBooking() {
    if (!slot || !selectedService) return;
    startTransition(async () => {
      const res = await bookPublicAppointment({
        serviceId,
        staffId: slot.staff_id,
        startsAt: slot.starts_at,
        email,
        fullName,
        phone: phone || undefined,
        extras,
      });
      if (res.error) setError(res.error);
      else {
        setError(null);
        setStep("done");
      }
    });
  }

  const totalMin = selectedService
    ? totalDurationMin(selectedService.duration_min, extras, extraCatalog)
    : 0;
  const totalPrice = selectedService
    ? totalPriceCents(selectedService.price_cents, extras, extraCatalog)
    : 0;
  const slotsByDate = useMemo(() => groupSlotsByDate(slots), [slots]);
  const availabilityValid =
    availability.fromDate &&
    availability.weekdays.length > 0 &&
    availability.timeFrom < availability.timeTo;

  if (step === "done") {
    return (
      <Card className="space-y-3 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{t("confirmed.title")}</h2>
        <p className="text-sm text-slate-600">
          {selectedService?.name} · {slot ? formatDateTime(slot.starts_at) : ""}
        </p>
        {extras.length > 0 ? (
          <p className="text-sm text-slate-500">{t("confirmed.withExtras")}</p>
        ) : null}
        <p className="text-sm text-slate-500">{t("confirmed.emailHint")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {stepLabels.map((label, i) => (
          <span key={label} className={stepIndex > i ? "font-medium text-slate-900" : ""}>
            {label}
          </span>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {step === "service" ? (
        <Card className="space-y-3">
          <h2 className="font-medium text-slate-900">{t("step1.title")}</h2>
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">{t("step1.empty")}</p>
          ) : (
            services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickService(s.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400"
              >
                <span>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color ?? "#64748b" }}
                  />
                  {s.name} · {t("step1.durationMin", { min: s.duration_min })}
                  {s.booking_mode === "quote" ? (
                    <span className="ml-2 text-xs text-violet-600">{t("step1.quoteBadge")}</span>
                  ) : null}
                  {s.booking_mode === "manual" ? (
                    <span className="ml-2 text-xs text-slate-500">{t("step1.manualBadge")}</span>
                  ) : null}
                </span>
                <span className="text-sm text-slate-500">
                  {s.booking_mode === "instant" ? formatPrice(s.price_cents) : t("step1.onRequest")}
                </span>
              </button>
            ))
          )}
        </Card>
      ) : null}

      {step === "quote" && selectedService ? (
        <QuoteRequestForm
          service={selectedService}
          onBack={() => {
            setServiceId("");
            setStep("service");
          }}
        />
      ) : null}

      {step === "staff" ? (
        <Card className="space-y-3">
          <h2 className="font-medium text-slate-900">{t("step2.title")}</h2>
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickStaff(s.id)}
              className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400"
            >
              {s.full_name}
            </button>
          ))}
          <Button variant="outline" onClick={() => setStep("service")}>
            {tCommon("back")}
          </Button>
        </Card>
      ) : null}

      {step === "extras" && selectedService ? (
        <Card className="space-y-4">
          <h2 className="font-medium text-slate-900">{t("extras.title")}</h2>
          <ExtrasPicker
            catalog={extraCatalog}
            baseDurationMin={selectedService.duration_min}
            basePriceCents={selectedService.price_cents}
            value={extras}
            onChange={setExtras}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setStep(extrasBeforeTime ? "staff" : "slots")
              }
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={() => {
                if (extrasBeforeTime) setStep("availability");
                else if (email && fullName) confirmBooking();
              }}
              disabled={extrasBeforeTime ? false : !email || !fullName || pending}
            >
              {extrasBeforeTime ? tCommon("continue") : t("step4.confirm")}
            </Button>
          </div>
          {!extrasBeforeTime && slot ? (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <Field label={t("step4.fullName")} htmlFor="full_name">
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <Field label={tCommon("email")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label={tCommon("phone")} htmlFor="phone">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === "availability" ? (
        <Card className="space-y-4">
          <h2 className="font-medium text-slate-900">{t("step3.title")}</h2>
          {hasExtras && extrasBeforeTime ? (
            <p className="text-sm text-slate-500">
              {t("extras.durationHint", { min: totalMin, price: formatPrice(totalPrice) })}
            </p>
          ) : null}
          <AvailabilityPreferencesForm value={availability} onChange={setAvailability} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(hasExtras && extrasBeforeTime ? "extras" : "staff")}
            >
              {tCommon("back")}
            </Button>
            <Button disabled={!availabilityValid || pending} onClick={loadSlots}>
              {t("step3.seeSlots")}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "slots" ? (
        <Card className="space-y-4">
          <h2 className="font-medium text-slate-900">{t("step4.title")}</h2>
          {hasExtras && !extrasBeforeTime ? (
            <p className="text-sm text-slate-500">{t("step4.extrasHint")}</p>
          ) : null}
          {slots.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">{t("step4.noSlots")}</p>
              <p className="text-xs text-slate-400">{t("step4.noSlotsHint")}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {slotsByDate.map(([dateKey, daySlots]) => (
                <div key={dateKey} className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    {format.dateTime(new Date(`${dateKey}T12:00:00`), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {daySlots.map((sl) => (
                      <button
                        key={sl.starts_at}
                        type="button"
                        onClick={() => pickSlot(sl)}
                        className={`rounded-lg border px-2 py-2 text-sm ${
                          slot?.starts_at === sl.starts_at
                            ? "border-slate-900 bg-slate-100 text-slate-900"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {format.dateTime(new Date(sl.starts_at), {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {slot && (!hasExtras || extrasBeforeTime) ? (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <Field label={t("step4.fullName")} htmlFor="full_name">
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <Field label={tCommon("email")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label={tCommon("phone")} htmlFor="phone">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Button
                className="w-full"
                disabled={pending || !email || !fullName}
                onClick={confirmBooking}
              >
                {pending ? t("step4.confirming") : t("step4.confirm")}
              </Button>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setStep("availability")}>
            {tCommon("back")}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
