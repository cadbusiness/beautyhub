"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClientRecord, updateClientRecord, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { ClientRow } from "@/lib/institut/clients";

const initial: ActionResult = {};

type ClientFormProps = {
  client?: ClientRow | null;
  onSuccess?: () => void;
};

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const t = useTranslations("institut.clients.form");
  const tCommon = useTranslations("common");
  const isEdit = Boolean(client);
  const actionFn = isEdit ? updateClientRecord : createClientRecord;
  const [state, action, pending] = useActionState(actionFn, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!isEdit) formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, onSuccess, isEdit]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {client ? <input type="hidden" name="client_id" value={client.id} /> : null}

      <Field label={t("fullName")} htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={client?.full_name ?? ""}
          placeholder={t("fullNamePlaceholder")}
        />
      </Field>
      <Field label={tCommon("email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={client?.email ?? ""}
          placeholder={t("emailPlaceholder")}
        />
      </Field>
      <Field label={tCommon("phone")} htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          defaultValue={client?.phone ?? ""}
          placeholder={t("phonePlaceholder")}
        />
      </Field>
      <Field label={t("dateOfBirth")} htmlFor="date_of_birth">
        <Input
          id="date_of_birth"
          name="date_of_birth"
          type="date"
          defaultValue={client?.date_of_birth ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("addressLine1")} htmlFor="address_line1">
          <Input
            id="address_line1"
            name="address_line1"
            defaultValue={client?.address_line1 ?? ""}
            placeholder={t("addressLine1Placeholder")}
          />
        </Field>
        <Field label={t("addressLine2")} htmlFor="address_line2">
          <Input
            id="address_line2"
            name="address_line2"
            defaultValue={client?.address_line2 ?? ""}
          />
        </Field>
        <Field label={t("postalCode")} htmlFor="postal_code">
          <Input
            id="postal_code"
            name="postal_code"
            defaultValue={client?.postal_code ?? ""}
          />
        </Field>
        <Field label={t("city")} htmlFor="city">
          <Input id="city" name="city" defaultValue={client?.city ?? ""} />
        </Field>
      </div>

      <Field label={t("tags")} htmlFor="tags">
        <Input
          id="tags"
          name="tags"
          defaultValue={client?.tags?.join(", ") ?? ""}
          placeholder={t("tagsPlaceholder")}
        />
        <p className="mt-1 text-xs text-slate-500">{t("tagsHint")}</p>
      </Field>

      <Field label={t("notes")} htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={client?.notes ?? ""}
          placeholder={t("notesPlaceholder")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={client?.marketing_opt_in ?? false}
          className="rounded border-slate-300"
        />
        {t("marketingOptIn")}
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? isEdit
            ? t("submittingEdit")
            : t("submitting")
          : isEdit
            ? t("submitEdit")
            : t("submit")}
      </Button>
    </form>
  );
}
