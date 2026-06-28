"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { inviteTeamMember, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { TenantRole } from "@/lib/institut/team-access";

const initial: ActionResult = {};

export function StaffInviteDialog({
  staff,
  roles,
  onSuccess,
}: {
  staff: { id: string; full_name: string; email: string | null };
  roles: TenantRole[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("institut.team.access");
  const [state, action, pending] = useActionState(inviteTeamMember, initial);

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  const assignableRoles = roles.filter((r) => r.slug !== "owner");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="staff_id" value={staff.id} />
      <p className="text-sm text-slate-600">
        {t("inviteDescription", { name: staff.full_name })}
      </p>
      <Field label={t("email")} htmlFor="invite_email">
        <Input
          id="invite_email"
          name="email"
          type="email"
          required
          defaultValue={staff.email ?? ""}
          placeholder={t("emailPlaceholder")}
        />
      </Field>
      <Field label={t("role")} htmlFor="tenant_role_id">
        <select
          id="tenant_role_id"
          name="tenant_role_id"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          defaultValue={assignableRoles[0]?.id ?? ""}
        >
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-slate-500">{t("inviteHint")}</p>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("inviteSubmitting") : t("inviteSubmit")}
      </Button>
    </form>
  );
}
