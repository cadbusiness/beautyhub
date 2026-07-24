"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createTimeOff, deleteTimeOff, type ActionResult } from "../schedule-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/input";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { formatDateTime } from "@/lib/utils";

const initial: ActionResult = {};

type StaffOption = { id: string; full_name: string };
type ResourceOption = { id: string; name: string };

type TimeOffRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  staff_id: string | null;
  resource_id: string | null;
  staff: { full_name: string } | null;
  resource: { name: string } | null;
};

function scopeLabel(row: TimeOffRow, t: ReturnType<typeof useTranslations>): string {
  if (row.staff_id && row.staff) return row.staff.full_name;
  if (row.resource_id && row.resource) return row.resource.name;
  return t("scopeInstitute");
}

export function TimeOffPanel({
  timeOffs,
  staff,
  resources,
}: {
  timeOffs: TimeOffRow[];
  staff: StaffOption[];
  resources: ResourceOption[];
}) {
  const t = useTranslations("institut.team.absences");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(createTimeOff, initial);
  const [scope, setScope] = useState("tenant");

  return (
    <>
      <ListToolbar>
        <div>
          <p className="text-sm font-medium text-slate-900">{t("formTitle")}</p>
          <p className="text-sm text-slate-600">{t("formDescription")}</p>
        </div>
      </ListToolbar>

      <form
        action={action}
        className="grid max-w-3xl gap-4 border-b border-slate-200 px-4 py-4 sm:grid-cols-2 lg:px-6"
      >
        <div className="sm:col-span-2">
          <Field label={t("scope")} htmlFor="absence-scope">
            <Select
              id="absence-scope"
              name="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="!w-full"
            >
              <option value="tenant">{t("scopeInstitute")}</option>
              <option value="staff">{t("scopeStaff")}</option>
              <option value="resource">{t("scopeResource")}</option>
            </Select>
          </Field>
        </div>

        {scope === "staff" && staff.length > 0 ? (
          <div className="sm:col-span-2">
            <Field label={t("staff")} htmlFor="absence-staff">
              <Select id="absence-staff" name="staff_id" defaultValue="" className="!w-full">
                <option value="">{t("chooseStaff")}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {scope === "resource" && resources.length > 0 ? (
          <div className="sm:col-span-2">
            <Field label={t("resource")} htmlFor="absence-resource">
              <Select id="absence-resource" name="resource_id" defaultValue="" className="!w-full">
                <option value="">{t("chooseResource")}</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <Field label={t("startsAt")} htmlFor="absence-start">
          <Input
            id="absence-start"
            type="datetime-local"
            name="starts_at"
            required
            className="!w-full"
          />
        </Field>
        <Field label={t("endsAt")} htmlFor="absence-end">
          <Input
            id="absence-end"
            type="datetime-local"
            name="ends_at"
            required
            className="!w-full"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label={t("reason")} htmlFor="absence-reason">
            <Textarea
              id="absence-reason"
              name="reason"
              placeholder={t("reasonPlaceholder")}
              className="!w-full min-h-16"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600">{t("saved")}</p> : null}
        </div>
      </form>

      <div className="border-b border-slate-200 px-4 py-2.5 lg:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("listTitle")}
        </h2>
      </div>
      <DataTable empty={timeOffs.length === 0 ? t("empty") : undefined}>
        {timeOffs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHeadCompact}>{t("columns.scope")}</th>
                <th className={dataTableHeadCompact}>{t("columns.period")}</th>
                <th className={dataTableHeadCompact}>{t("columns.reason")}</th>
                <th className={`w-24 text-right ${dataTableHeadCompact}`}>
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {timeOffs.map((row) => (
                <tr key={row.id} className={dataTableRow}>
                  <td className={`font-medium text-slate-900 ${dataTableCellCompact}`}>
                    {scopeLabel(row, t)}
                  </td>
                  <td className={`text-slate-600 ${dataTableCellCompact}`}>
                    {formatDateTime(row.starts_at)} → {formatDateTime(row.ends_at)}
                  </td>
                  <td className={`text-slate-600 ${dataTableCellCompact}`}>
                    {row.reason ?? tCommon("dash")}
                  </td>
                  <td className={`text-right ${dataTableCellCompact}`}>
                    <RowActions className="justify-end">
                      <form action={deleteTimeOff}>
                        <input type="hidden" name="id" value={row.id} />
                        <RowActionButton
                          type="submit"
                          iconOnly
                          tone="danger"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          {t("delete")}
                        </RowActionButton>
                      </form>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>
    </>
  );
}
