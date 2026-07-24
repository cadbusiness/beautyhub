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
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { ListToolbar } from "@/components/ui/list-toolbar";

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
      <td className={`font-medium text-slate-900 ${dataTableCellCompact}`}>{entityName}</td>
      <td className={dataTableCellCompact}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name={fieldName} value={entityId} />
          <Select
            name="schedule_id"
            defaultValue={currentScheduleId ?? ""}
            className="!h-8 !w-auto min-w-48 max-w-xs"
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
          {state.ok ? <span className="text-xs text-emerald-600">{t("saved")}</span> : null}
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
    <>
      <ListToolbar>
        <p className="text-sm text-slate-600">
          {t("description", { defaultName: defaultSchedule?.name ?? t("noneDefault") })}
        </p>
      </ListToolbar>

      <div className="border-b border-slate-200 px-4 py-2.5 lg:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("staffTitle")}
        </h2>
      </div>
      <DataTable empty={staff.length === 0 ? t("noStaff") : undefined}>
        {staff.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={`w-48 ${dataTableHeadCompact}`}>{t("columns.name")}</th>
                <th className={dataTableHeadCompact}>{t("columns.schedule")}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <StaffAssignmentRow
                  key={s.id}
                  staffId={s.id}
                  name={s.full_name}
                  currentScheduleId={s.schedule_id}
                  schedules={schedules}
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>

      <div className="border-b border-t border-slate-200 px-4 py-2.5 lg:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("resourcesTitle")}
        </h2>
      </div>
      <DataTable empty={resources.length === 0 ? t("noResources") : undefined}>
        {resources.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={`w-48 ${dataTableHeadCompact}`}>{t("columns.name")}</th>
                <th className={dataTableHeadCompact}>{t("columns.schedule")}</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <ResourceAssignmentRow
                  key={r.id}
                  resourceId={r.id}
                  name={r.name}
                  currentScheduleId={r.schedule_id}
                  schedules={schedules}
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>
    </>
  );
}
