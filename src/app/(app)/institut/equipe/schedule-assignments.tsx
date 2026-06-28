"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  assignResourceSchedule,
  assignStaffSchedule,
  type ActionResult,
} from "../schedule-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";

const initial: ActionResult = {};

type ScheduleOption = { id: string; name: string; is_default: boolean };

type StaffRow = { id: string; full_name: string; schedule_id: string | null };
type ResourceRow = { id: string; name: string; schedule_id: string | null };

function StaffAssignmentRow({
  staffId,
  name,
  currentScheduleId,
  schedules,
}: {
  staffId: string;
  name: string;
  currentScheduleId: string | null;
  schedules: ScheduleOption[];
}) {
  const t = useTranslations("institut.team.assignments");
  const [state, action, pending] = useActionState(assignStaffSchedule, initial);

  return (
    <AssignmentRowInner
      entityId={staffId}
      entityName={name}
      fieldName="staff_id"
      currentScheduleId={currentScheduleId}
      schedules={schedules}
      action={action}
      pending={pending}
      state={state}
      defaultLabel={t("useDefault")}
    />
  );
}

function ResourceAssignmentRow({
  resourceId,
  name,
  currentScheduleId,
  schedules,
}: {
  resourceId: string;
  name: string;
  currentScheduleId: string | null;
  schedules: ScheduleOption[];
}) {
  const t = useTranslations("institut.team.assignments");
  const [state, action, pending] = useActionState(assignResourceSchedule, initial);

  return (
    <AssignmentRowInner
      entityId={resourceId}
      entityName={name}
      fieldName="resource_id"
      currentScheduleId={currentScheduleId}
      schedules={schedules}
      action={action}
      pending={pending}
      state={state}
      defaultLabel={t("useDefault")}
    />
  );
}

function AssignmentRowInner({
  entityId,
  entityName,
  fieldName,
  currentScheduleId,
  schedules,
  action,
  pending,
  state,
  defaultLabel,
}: {
  entityId: string;
  entityName: string;
  fieldName: "staff_id" | "resource_id";
  currentScheduleId: string | null;
  schedules: ScheduleOption[];
  action: (payload: FormData) => void;
  pending: boolean;
  state: ActionResult;
  defaultLabel: string;
}) {
  const t = useTranslations("institut.team.assignments");

  return (
    <tr className={dataTableRow}>
      <td className={`font-medium text-slate-900 ${dataTableCell}`}>{entityName}</td>
      <td className={dataTableCell}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name={fieldName} value={entityId} />
          <Select
            name="schedule_id"
            defaultValue={currentScheduleId ?? ""}
            className="!w-auto min-w-48 max-w-xs"
          >
            <option value="">{defaultLabel}</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_default ? ` (${t("defaultShort")})` : ""}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" className="h-8" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
          {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
          {state.ok ? <span className="text-xs text-green-600">{t("saved")}</span> : null}
        </form>
      </td>
    </tr>
  );
}

export function ScheduleAssignmentsPanel({
  staff,
  resources,
  schedules,
}: {
  staff: StaffRow[];
  resources: ResourceRow[];
  schedules: ScheduleOption[];
}) {
  const t = useTranslations("institut.team.assignments");
  const defaultSchedule = schedules.find((s) => s.is_default);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        {t("description", { defaultName: defaultSchedule?.name ?? t("noneDefault") })}
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("staffTitle")}</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={`w-48 ${dataTableHead}`}>{t("columns.name")}</th>
                <th className={dataTableHead}>{t("columns.schedule")}</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                    {t("noStaff")}
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <StaffAssignmentRow
                    key={s.id}
                    staffId={s.id}
                    name={s.full_name}
                    currentScheduleId={s.schedule_id}
                    schedules={schedules}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("resourcesTitle")}</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={`w-48 ${dataTableHead}`}>{t("columns.name")}</th>
                <th className={dataTableHead}>{t("columns.schedule")}</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                    {t("noResources")}
                  </td>
                </tr>
              ) : (
                resources.map((r) => (
                  <ResourceAssignmentRow
                    key={r.id}
                    resourceId={r.id}
                    name={r.name}
                    currentScheduleId={r.schedule_id}
                    schedules={schedules}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
