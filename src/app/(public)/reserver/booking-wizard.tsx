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
import { BookingStepper } from "@/components/booking/booking-stepper";
import { QuoteRequestForm } from "./quote-request-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";
import type { BookingExtraLine, ServiceExtraConfig } from "@/lib/institut/service-extras";
import { totalDurationMin, totalPriceCents } from "@/lib/institut/service-extras";
import type { BookingFlowConfig } from "@/lib/institut/booking-flows";
import {
  groupSlotsByDate,
  type AvailabilityPreferences,
} from "@/lib/public/booking-availability";

type WizardStep = "service" | "quote" | "extras" | "slots" | "details" | "done";

const BOOKABLE_MODES = new Set(["instant"]);

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
    fromDate: availability.fromDate,
    weekdays: availability.weekdays.join(","),
    timeFrom: availability.timeFrom,
    timeTo: availability.timeTo,
  });
  if (staffId) params.set("staffId", staffId);
  if (extras.length > 0) params.set("extras", JSON.stringify(extras));
  const res = await fetch(`/api/public/booking?${params}`);
  if (!res.ok) throw new Error("load_failed");
  return res.json();
}

export function BookingWizard({
  initialServiceId = "",
  services,
  flowConfig,
}: {
  initialServiceId?: string;
  services: PublicService[];
  flowConfig?: BookingFlowConfig;
  flowName?: string;
}) {
  const cfg = flowConfig;
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
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountCents, setPromoDiscountCents] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deepLinked = useRef(false);

  const bookableServices = useMemo(
    () => services.filter((s) => BOOKABLE_MODES.has(s.booking_mode)),
    [services],
  );

  const selectedService = services.find((s) => s.id === serviceId);
  const showExtrasStep = cfg?.showExtrasStep !== false;
  const hasExtras = showExtrasStep && extraCatalog.length > 0;
  const showStaffPicker = cfg?.showStaffPicker !== false;
  const requireStaff = cfg?.requireStaff === true;
  const requirePhone = cfg?.requirePhone === true;

  const stepFlow = useMemo((): WizardStep[] => {
    const flow: WizardStep[] = ["service"];
    if (hasExtras) flow.push("extras");
    flow.push("slots", "details");
    return flow;
  }, [hasExtras]);

  const stepperSteps = useMemo(() => {
    const steps = [{ id: "service", label: t("steps.service") }];
    if (hasExtras) steps.push({ id: "extras", label: t("steps.extras") });
    steps.push(
      { id: "slots", label: t("steps.slots") },
      { id: "details", label: t("steps.details") },
      { id: "done", label: t("steps.done") },
    );
    return steps;
  }, [hasExtras, t]);

  const stepperIndex = useMemo(() => {
    if (step === "done") return stepperSteps.length - 1;
    if (step === "quote") return 0;
    const idx = stepperSteps.findIndex((s) => s.id === step);
    return idx >= 0 ? idx : 0;
  }, [step, stepperSteps]);

  const availabilityValid =
    availability.fromDate &&
    availability.weekdays.length > 0 &&
    availability.timeFrom < availability.timeTo;

  function preloadServiceData(id: string) {
    startTransition(async () => {
      try {
        const [staffList, catalog] = await Promise.all([
          fetchBookingStaff(id),
          fetchBookingExtras(id),
        ]);
        setStaff(staffList);
        setExtraCatalog(catalog);
      } catch {
        setError(t("loadError"));
      }
    });
  }

  function onServiceChange(id: string) {
    setServiceId(id);
    setStaffId("");
    setSlot(null);
    setExtras([]);
    setSlots([]);
    setError(null);

    const service = services.find((s) => s.id === id);
    if (!service) return;

    if (service.booking_mode === "quote" || service.booking_mode === "manual") {
      setStep("quote");
      return;
    }

    setStep("service");
    preloadServiceData(id);
  }

  useEffect(() => {
    if (!initialServiceId || deepLinked.current) return;
    if (!services.some((s) => s.id === initialServiceId)) return;
    deepLinked.current = true;
    onServiceChange(initialServiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep link once on mount
  }, [initialServiceId, services]);

  function loadSlots() {
    if (!serviceId || !availabilityValid) return;
    startTransition(async () => {
      try {
        const list = await fetchBookingSlotsByAvailability(
          serviceId,
          staffId,
          extras,
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

  function continueFromService() {
    if (!serviceId || !availabilityValid) return;
    if (requireStaff && !staffId) {
      setError(t("step1.staffRequired"));
      return;
    }
    setError(null);
    if (hasExtras) setStep("extras");
    else loadSlots();
  }

  function continueFromExtras() {
    loadSlots();
  }

  function pickSlot(sl: PublicSlot) {
    setSlot(sl);
    setStaffId(sl.staff_id);
    setStep("details");
  }

  const totalMin = selectedService
    ? totalDurationMin(selectedService.duration_min, extras, extraCatalog)
    : 0;
  const totalPrice = selectedService
    ? totalPriceCents(selectedService.price_cents, extras, extraCatalog)
    : 0;
  const netPrice = Math.max(0, totalPrice - promoDiscountCents);
  const slotsByDate = useMemo(() => groupSlotsByDate(slots), [slots]);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code || totalPrice <= 0) return;
    setPromoPending(true);
    setPromoError(null);
    try {
      const params = new URLSearchParams({
        code,
        subtotal_cents: String(totalPrice),
      });
      const res = await fetch(`/api/public/promos/validate?${params}`);
      const data = (await res.json()) as {
        valid?: boolean;
        error?: string | null;
        discount_cents?: number;
        code?: string | null;
      };
      if (!data.valid) {
        setPromoCode("");
        setPromoDiscountCents(0);
        setPromoError(data.error ?? "promo_invalid");
        return;
      }
      setPromoCode(data.code ?? code.toUpperCase());
      setPromoDiscountCents(data.discount_cents ?? 0);
      setPromoError(null);
    } catch {
      setPromoCode("");
      setPromoDiscountCents(0);
      setPromoError("promo_invalid");
    } finally {
      setPromoPending(false);
    }
  }

  function clearPromo() {
    setPromoInput("");
    setPromoCode("");
    setPromoDiscountCents(0);
    setPromoError(null);
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
        promoCode: promoCode || undefined,
      });
      if (res.error) setError(res.error);
      else {
        setError(null);
        setStep("done");
      }
    });
  }

  function goBack() {
    const idx = stepFlow.indexOf(step);
    if (idx <= 0) return;
    setStep(stepFlow[idx - 1]!);
  }

  if (step === "done") {
    return (
      <div className="space-y-6">
        <BookingStepper steps={stepperSteps} currentIndex={stepperSteps.length - 1} />
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step !== "quote" ? (
        <BookingStepper steps={stepperSteps} currentIndex={stepperIndex} />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {step === "service" ? (
        <Card className="space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="font-medium text-slate-900">{t("step1.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("step1.subtitle")}</p>
          </div>

          {bookableServices.length === 0 ? (
            <p className="text-sm text-slate-500">{t("step1.empty")}</p>
          ) : (
            <>
              <Field label={t("step1.serviceLabel")} htmlFor="booking_service">
                <Select
                  id="booking_service"
                  value={serviceId}
                  onChange={(e) => onServiceChange(e.target.value)}
                >
                  <option value="">{t("step1.servicePlaceholder")}</option>
                  {bookableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {t("step1.durationMin", { min: s.duration_min })} ·{" "}
                      {formatPrice(s.price_cents)}
                    </option>
                  ))}
                </Select>
              </Field>

              {serviceId && showStaffPicker && staff.length > 0 ? (
                <Field label={t("step1.staffLabel")} htmlFor="booking_staff">
                  <Select
                    id="booking_staff"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required={requireStaff}
                  >
                    {!requireStaff ? (
                      <option value="">{t("step1.staffAny")}</option>
                    ) : (
                      <option value="" disabled>
                        {t("step1.staffPlaceholder")}
                      </option>
                    )}
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {serviceId ? (
                <AvailabilityPreferencesForm
                  value={availability}
                  onChange={setAvailability}
                  variant="inline"
                />
              ) : null}
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button
              disabled={!serviceId || !availabilityValid || pending}
              onClick={continueFromService}
            >
              {tCommon("continue")}
            </Button>
          </div>
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

      {step === "extras" && selectedService ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="font-medium text-slate-900">{t("extras.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("extras.subtitle")}</p>
          </div>
          <ExtrasPicker
            catalog={extraCatalog}
            baseDurationMin={selectedService.duration_min}
            basePriceCents={selectedService.price_cents}
            value={extras}
            onChange={setExtras}
          />
          <p className="text-sm text-slate-500">
            {t("extras.durationHint", { min: totalMin, price: formatPrice(totalPrice) })}
          </p>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep("service")}>
              {tCommon("back")}
            </Button>
            <Button disabled={pending} onClick={continueFromExtras}>
              {t("step3.seeSlots")}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "slots" ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="font-medium text-slate-900">{t("step4.title")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("step4.subtitle")}</p>
          </div>
          {pending ? (
            <p className="text-sm text-slate-500">{t("step4.loading")}</p>
          ) : slots.length === 0 ? (
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
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={goBack}>
              {tCommon("back")}
            </Button>
            <Button variant="outline" onClick={() => setStep("service")}>
              {t("step4.changeAvailability")}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "details" && selectedService && slot ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="font-medium text-slate-900">{t("step5.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {selectedService.name} · {formatDateTime(slot.starts_at)}
              {totalMin > selectedService.duration_min
                ? ` · ${t("extras.durationHint", { min: totalMin, price: formatPrice(totalPrice) })}`
                : null}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {promoDiscountCents > 0 ? (
                <>
                  <span className="text-slate-400 line-through">{formatPrice(totalPrice)}</span>
                  {" · "}
                  <span className="font-medium">{formatPrice(netPrice)}</span>
                </>
              ) : (
                <span className="font-medium">{formatPrice(totalPrice)}</span>
              )}
            </p>
          </div>
          <Field label={t("step5.fullName")} htmlFor="full_name">
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
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={requirePhone}
            />
          </Field>
          <Field label={t("step5.promoCode")} htmlFor="booking_promo">
            <div className="flex gap-2">
              <Input
                id="booking_promo"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={t("step5.promoPlaceholder")}
                className="uppercase"
                disabled={Boolean(promoCode)}
              />
              {promoCode ? (
                <Button type="button" variant="outline" onClick={clearPromo}>
                  {t("step5.promoClear")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyPromo}
                  disabled={promoPending || !promoInput.trim()}
                >
                  {promoPending ? t("step5.promoApplying") : t("step5.promoApply")}
                </Button>
              )}
            </div>
          </Field>
          {promoCode && promoDiscountCents > 0 ? (
            <p className="text-xs text-emerald-700">
              {t("step5.promoApplied", {
                code: promoCode,
                amount: formatPrice(promoDiscountCents),
              })}
            </p>
          ) : null}
          {promoError ? (
            <p className="text-xs text-red-600">
              {t(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic error code from API
                `step5.promoErrors.${promoError}` as any,
              )}
            </p>
          ) : null}
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep("slots")}>
              {tCommon("back")}
            </Button>
            <Button
              disabled={pending || !email || !fullName || (requirePhone && !phone.trim())}
              onClick={confirmBooking}
            >
              {pending ? t("step5.confirming") : t("step5.confirm")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
