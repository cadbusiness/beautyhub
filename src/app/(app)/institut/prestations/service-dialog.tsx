"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createService, updateService, type ActionResult } from "../actions";
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
  buffer_before_min: number;
  buffer_after_min: number;
  min_advance_hours: number;
  max_advance_days: number;
};

type Tab = "general" | "time" | "advanced";

const initial: ActionResult = {};

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "time", label: "Horaires" },
  { id: "advanced", label: "Avance" },
];

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

export function ServiceDialog({
  open,
  service,
  onClose,
}: {
  open: boolean;
  service: ServiceRow | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("general");
  const isEdit = Boolean(service);

  const action = isEdit ? updateService : createService;
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setTab("general");
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onClose();
    }
  }, [state.ok, onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto w-[min(100vw-2rem,520px)] max-h-[min(90vh,720px)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <form ref={formRef} action={formAction} className="flex max-h-[min(90vh,720px)] flex-col">
        {service ? <input type="hidden" name="id" value={service.id} /> : null}

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? "Modifier prestation" : "Nouvelle prestation"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {isEdit ? (
          <div className="flex gap-1 border-b border-slate-200 px-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <TabPanel active={!isEdit || tab === "general"}>
            <Field label="Nom" htmlFor="name">
              <Input
                id="name"
                name="name"
                required
                placeholder="Soin du visage"
                defaultValue={service?.name ?? ""}
              />
            </Field>

            <div className="grid grid-cols-[72px_1fr] gap-4">
              <Field label="Couleur" htmlFor="color">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  className="h-10 cursor-pointer p-1"
                  defaultValue={service?.color ?? "#be185d"}
                />
              </Field>
              <Field label="Prix (EUR)" htmlFor="price">
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

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                placeholder="Optionnel — visible en interne"
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
                <span className="block text-sm font-medium text-slate-900">Visible</span>
                <span className="text-xs text-slate-500">
                  Desactive pour masquer aux clients et a la caisse.
                </span>
              </span>
            </label>
          </TabPanel>

          <TabPanel active={!isEdit || tab === "time"}>
            <Field label="Duree (min)" htmlFor="duration_min">
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
              <Field label="Tampon avant (min)" htmlFor="buffer_before_min">
                <Input
                  id="buffer_before_min"
                  name="buffer_before_min"
                  type="number"
                  min={0}
                  defaultValue={service?.buffer_before_min ?? 0}
                />
              </Field>
              <Field label="Tampon apres (min)" htmlFor="buffer_after_min">
                <Input
                  id="buffer_after_min"
                  name="buffer_after_min"
                  type="number"
                  min={0}
                  defaultValue={service?.buffer_after_min ?? 0}
                />
              </Field>
            </div>
            {isEdit ? (
              <p className="text-xs text-slate-500">
                Les tampons bloquent du temps avant et apres chaque rendez-vous.
              </p>
            ) : null}
          </TabPanel>

          <TabPanel active={!isEdit || tab === "advanced"}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Delai minimum (h)" htmlFor="min_advance_hours">
                <Input
                  id="min_advance_hours"
                  name="min_advance_hours"
                  type="number"
                  min={0}
                  defaultValue={service?.min_advance_hours ?? 0}
                />
              </Field>
              <Field label="Resa max (jours)" htmlFor="max_advance_days">
                <Input
                  id="max_advance_days"
                  name="max_advance_days"
                  type="number"
                  min={1}
                  defaultValue={service?.max_advance_days ?? 60}
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Controle la fenetre de reservation en ligne pour cette prestation.
            </p>
          </TabPanel>

          {state.error ? <p className="mt-4 text-sm text-red-600">{state.error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : isEdit ? "Enregistrer" : "Creer la prestation"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
