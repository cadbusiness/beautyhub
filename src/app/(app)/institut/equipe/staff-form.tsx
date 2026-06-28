"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createStaffMember, updateStaffMember, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: ActionResult = {};

type StaffFormProps = {
  staff?: {
    id: string;
    full_name: string;
    email: string | null;
    color: string | null;
  } | null;
  onSuccess?: () => void;
};

export function StaffForm({ staff, onSuccess }: StaffFormProps) {
  const t = useTranslations("institut.team.personnel.form");
  const isEdit = Boolean(staff);
  const actionFn = isEdit ? updateStaffMember : createStaffMember;
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
      {staff ? <input type="hidden" name="id" value={staff.id} /> : null}
      <Field label={t("fullName")} htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={staff?.full_name ?? ""}
          placeholder={t("fullNamePlaceholder")}
        />
      </Field>
      <Field label={t("emailOptional")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={staff?.email ?? ""}
          placeholder={t("emailPlaceholder")}
        />
      </Field>
      <Field label={t("colorOptional")} htmlFor="color">
        <Input
          id="color"
          name="color"
          type="color"
          defaultValue={staff?.color ?? "#64748b"}
          className="h-10 w-16 p-1"
        />
      </Field>
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
