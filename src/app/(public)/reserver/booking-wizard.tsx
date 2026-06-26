"use client";

import { useEffect, useState, useTransition } from "react";
import {
  bookPublicAppointment,
  loadPublicServices,
  loadPublicSlots,
  loadPublicStaff,
  type PublicService,
  type PublicSlot,
  type PublicStaff,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { formatDateTime, formatPrice } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;

export function BookingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<PublicService[]>([]);
  const [staff, setStaff] = useState<PublicStaff[]>([]);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadPublicServices().then(setServices);
  }, []);

  const selectedService = services.find((s) => s.id === serviceId);

  function pickService(id: string) {
    setServiceId(id);
    setStaffId("");
    setSlot(null);
    startTransition(async () => {
      const list = await loadPublicStaff(id);
      setStaff(list);
      setStep(2);
    });
  }

  function pickStaff(id: string) {
    setStaffId(id);
    setStep(3);
  }

  function loadSlots() {
    if (!serviceId || !date || !staffId) return;
    startTransition(async () => {
      const list = await loadPublicSlots(serviceId, date, staffId);
      setSlots(list);
      setStep(4);
    });
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
      });
      if (res.error) setError(res.error);
      else {
        setError(null);
        setDone(true);
        setStep(5);
      }
    });
  }

  if (done) {
    return (
      <Card className="space-y-3 text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Rendez-vous confirme
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {selectedService?.name} · {slot ? formatDateTime(slot.starts_at) : ""}
        </p>
        <p className="text-sm text-slate-500">
          Un email de confirmation vous sera envoye prochainement.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-xs text-slate-400">
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={step >= s ? "font-medium text-slate-900 dark:text-white" : ""}
          >
            Etape {s}
          </span>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {step === 1 ? (
        <Card className="space-y-3">
          <h2 className="font-medium text-slate-900 dark:text-white">Choisir une prestation</h2>
          {services.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune prestation disponible.</p>
          ) : (
            services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickService(s.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400 dark:border-slate-700"
              >
                <span>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color ?? "#be185d" }}
                  />
                  {s.name} · {s.duration_min} min
                </span>
                <span className="text-sm text-slate-500">{formatPrice(s.price_cents)}</span>
              </button>
            ))
          )}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-3">
          <h2 className="font-medium text-slate-900 dark:text-white">Choisir un praticien</h2>
          {staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickStaff(s.id)}
              className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400 dark:border-slate-700"
            >
              {s.full_name}
            </button>
          ))}
          <Button variant="outline" onClick={() => setStep(1)}>
            Retour
          </Button>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4">
          <h2 className="font-medium text-slate-900 dark:text-white">Choisir une date</h2>
          <Field label="Date" htmlFor="date">
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button disabled={!date || pending} onClick={loadSlots}>
              Voir les creneaux
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="space-y-4">
          <h2 className="font-medium text-slate-900 dark:text-white">Choisir un creneau</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun creneau disponible ce jour.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((sl) => (
                <button
                  key={sl.starts_at}
                  type="button"
                  onClick={() => {
                    setSlot(sl);
                    setStep(4);
                  }}
                  className={`rounded-lg border px-2 py-2 text-sm ${
                    slot?.starts_at === sl.starts_at
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:border-slate-400 dark:border-slate-700"
                  }`}
                >
                  {new Date(sl.starts_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
          {slot ? (
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Field label="Nom complet" htmlFor="full_name">
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Telephone" htmlFor="phone">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Button
                className="w-full"
                disabled={pending || !email || !fullName}
                onClick={confirmBooking}
              >
                {pending ? "Confirmation..." : "Confirmer le rendez-vous"}
              </Button>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setStep(3)}>
            Retour
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
