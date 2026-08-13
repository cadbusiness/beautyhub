"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { archiveStaffMember, type ActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import type { StaffWithAccess } from "@/lib/institut/team-access";

const initial: ActionResult = {};

type ImpactPayload = {
  staff: { id: string; full_name: string; is_active: boolean; archived_at: string | null };
  upcomingAppointments: number;
  pastAppointments: number;
  sales: number;
  accessStatus: "active" | "pending" | "none";
  canHardDelete: boolean;
  otherActiveStaff: Array<{ id: string; full_name: string; color: string | null }>;
};

export function StaffArchiveDialog({
  staff,
  onSuccess,
}: {
  staff: StaffWithAccess;
  onSuccess?: () => void;
}) {
  const t = useTranslations("institut.team.personnel.archiveDialog");
  const tCommon = useTranslations("common");
  const tPersonnel = useTranslations("institut.team.personnel");
  const [state, action, pending] = useActionState(archiveStaffMember, initial);
  const [impact, setImpact] = useState<ImpactPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/institut/staff/${staff.id}/impact`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as ImpactPayload;
      })
      .then((data) => {
        if (!cancelled) {
          setImpact(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t("loadFailed"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [staff.id, t]);

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  const hasAccess = impact ? impact.accessStatus !== "none" : staff.access_status !== "none";
  const otherActive = impact?.otherActiveStaff ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        {t.rich("description", {
          name: staff.full_name,
          strong: (chunks) => <strong className="font-medium text-slate-900">{chunks}</strong>,
        })}
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        {loading ? (
          <p>{t("loading")}</p>
        ) : loadError ? (
          <p className="text-red-600">{loadError}</p>
        ) : impact ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            <li>
              <span className="text-slate-500">{t("impact.upcoming")}</span>{" "}
              <span className="font-medium text-slate-900">{impact.upcomingAppointments}</span>
            </li>
            <li>
              <span className="text-slate-500">{t("impact.past")}</span>{" "}
              <span className="font-medium text-slate-900">{impact.pastAppointments}</span>
            </li>
            <li>
              <span className="text-slate-500">{t("impact.sales")}</span>{" "}
              <span className="font-medium text-slate-900">{impact.sales}</span>
            </li>
            <li>
              <span className="text-slate-500">{t("impact.access")}</span>{" "}
              <span className="font-medium text-slate-900">
                {impact.accessStatus === "active"
                  ? tPersonnel("accessActive")
                  : impact.accessStatus === "pending"
                    ? tPersonnel("accessPending")
                    : tPersonnel("accessNone")}
              </span>
            </li>
          </ul>
        ) : null}
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={staff.id} />

        {impact && impact.upcomingAppointments > 0 && otherActive.length > 0 ? (
          <Field label={t("reassignLabel")} htmlFor="reassign_to">
            <select
              id="reassign_to"
              name="reassign_to"
              defaultValue=""
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">{t("reassignNone")}</option>
              {otherActive.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {hasAccess ? (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="revoke_access"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="font-medium">{t("revokeAccessLabel")}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t("revokeAccessHint")}</span>
            </span>
          </label>
        ) : null}

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            onClick={onSuccess}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="submit"
            className="h-9 bg-red-600 text-white hover:bg-red-700"
            disabled={pending || loading}
          >
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
