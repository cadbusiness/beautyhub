"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createStaffMember,
  inviteTeamMember,
  resendTeamInvitation,
  resetStaffPassword,
  updateStaffMember,
  type ActionResult,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { StaffWithAccess, TenantRole } from "@/lib/institut/team-access";
import { StaffAvatarField } from "./staff-avatar-field";
import { uploadStaffAvatar } from "./staff-image-actions";

const initial: ActionResult = {};

type StaffFormProps = {
  staff?: StaffWithAccess | null;
  roles?: TenantRole[];
  onSuccess?: () => void;
  onInviteRequest?: () => void;
};

function inviteUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/invite/${token}`;
  }
  return `/invite/${token}`;
}

export function StaffForm({ staff, roles = [], onSuccess, onInviteRequest }: StaffFormProps) {
  const t = useTranslations("institut.team.personnel.form");
  const tAccess = useTranslations("institut.team.access");
  const tPersonnel = useTranslations("institut.team.personnel");
  const router = useRouter();
  const isEdit = Boolean(staff);
  const actionFn = isEdit ? updateStaffMember : createStaffMember;
  const [state, action, pending] = useActionState(actionFn, initial);
  const [resetState, resetAction, resetPending] = useActionState(resetStaffPassword, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(inviteTeamMember, initial);
  const [resendPending, startResend] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const assignableRoles = roles.filter((r) => r.slug !== "owner");

  useEffect(() => {
    if (!state.ok) return;

    async function finish() {
      if (!isEdit && state.staffId && pendingAvatar) {
        const fd = new FormData();
        fd.set("file", pendingAvatar);
        await uploadStaffAvatar(state.staffId, fd);
      }
      if (!isEdit) formRef.current?.reset();
      setPendingAvatar(null);
      onSuccess?.();
    }

    void finish();
  }, [state.ok, state.staffId, isEdit, pendingAvatar, onSuccess]);

  useEffect(() => {
    if (inviteState.ok) {
      router.refresh();
      onSuccess?.();
    }
  }, [inviteState.ok, onSuccess, router]);

  useEffect(() => {
    if (resetState.ok) router.refresh();
  }, [resetState.ok, router]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="space-y-4">
        {staff ? <input type="hidden" name="id" value={staff.id} /> : null}

        <StaffAvatarField
          staffId={staff?.id}
          name={staff?.full_name}
          color={staff?.color}
          initialUrl={staff?.avatar_url}
          onPendingFile={setPendingAvatar}
        />

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

        {isEdit && assignableRoles.length > 0 ? (
          <Field label={t("role")} htmlFor="tenant_role_id">
            <select
              id="tenant_role_id"
              name="tenant_role_id"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              defaultValue={staff?.tenant_role_id ?? assignableRoles[0]?.id ?? ""}
            >
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

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

      {isEdit && staff ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("accessSection")}
          </h3>
          <p className="text-sm text-slate-600">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                staff.access_status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : staff.access_status === "pending"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {staff.access_status === "active"
                ? tPersonnel("accessActive")
                : staff.access_status === "pending"
                  ? tPersonnel("accessPending")
                  : tPersonnel("accessNone")}
            </span>
            {staff.tenant_role_name ? (
              <span className="ml-2 text-xs text-slate-500">{staff.tenant_role_name}</span>
            ) : null}
          </p>

          {staff.access_status === "none" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{t("inviteHint")}</p>
              <form action={inviteAction} className="space-y-3">
                <input type="hidden" name="staff_id" value={staff.id} />
                <Field label={tAccess("email")} htmlFor="invite_email_inline">
                  <Input
                    id="invite_email_inline"
                    name="email"
                    type="email"
                    required
                    defaultValue={staff.email ?? ""}
                    placeholder={tAccess("emailPlaceholder")}
                  />
                </Field>
                {assignableRoles.length > 0 ? (
                  <Field label={tAccess("role")} htmlFor="invite_role_inline">
                    <select
                      id="invite_role_inline"
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
                ) : null}
                {inviteState.error ? (
                  <p className="text-sm text-red-600">{inviteState.error}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="outline" className="h-9" disabled={invitePending}>
                    {invitePending ? tAccess("inviteSubmitting") : tPersonnel("invite")}
                  </Button>
                  {onInviteRequest ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9"
                      onClick={onInviteRequest}
                    >
                      {t("openInviteDialog")}
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          ) : null}

          {staff.access_status === "pending" && staff.invitation_id ? (
            <div className="flex flex-wrap gap-2">
              {staff.invitation_token ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteUrl(staff.invitation_token!));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? t("linkCopied") : tAccess("copyLink")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={resendPending}
                onClick={() => {
                  startResend(async () => {
                    const fd = new FormData();
                    fd.set("invitation_id", staff.invitation_id!);
                    await resendTeamInvitation(fd);
                    router.refresh();
                  });
                }}
              >
                {resendPending ? t("resending") : t("resendInvite")}
              </Button>
              <p className="w-full text-xs text-slate-500">{tAccess("emailComingSoon")}</p>
            </div>
          ) : null}

          {staff.access_status === "active" ? (
            <form action={resetAction} className="space-y-3">
              <input type="hidden" name="staff_id" value={staff.id} />
              <p className="text-xs text-slate-500">{t("resetPasswordHint")}</p>
              <Button type="submit" variant="outline" className="h-9" disabled={resetPending}>
                {resetPending ? t("resetPasswordSubmitting") : t("resetPassword")}
              </Button>
              {resetState.error ? (
                <p className="text-sm text-red-600">{resetState.error}</p>
              ) : null}
              {resetState.temporaryPassword ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p className="font-medium">{t("tempPasswordLabel")}</p>
                  <p className="mt-1 font-mono tracking-wide">{resetState.temporaryPassword}</p>
                  <button
                    type="button"
                    className="mt-1 text-xs underline-offset-2 hover:underline"
                    onClick={() =>
                      void navigator.clipboard.writeText(resetState.temporaryPassword!)
                    }
                  >
                    {t("copyPassword")}
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
