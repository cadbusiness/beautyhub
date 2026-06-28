"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteStaffMember, deleteResource } from "../actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PageTabs } from "@/components/ui/page-tabs";
import { StaffForm } from "./staff-form";
import { ResourceForm } from "./resource-form";
import { WorkingHoursForm } from "./working-hours-form";

type Tab = "personnel" | "cabines" | "horaires";

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  color: string | null;
};

type ResourceRow = {
  id: string;
  name: string;
};

type HourRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export function EquipeManager({
  staff,
  resources,
  hours,
}: {
  staff: StaffRow[];
  resources: ResourceRow[];
  hours: HourRow[];
}) {
  const t = useTranslations("institut.team");
  const tCommon = useTranslations("common");
  const [tab, setTab] = useState<Tab>("personnel");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false),
    );
  }, [staff, staffQuery]);

  return (
    <>
      <ListPanel>
        <PageTabs
          tabs={[
            { id: "personnel", label: t("tabs.personnel"), count: staff.length },
            { id: "cabines", label: t("tabs.cabines"), count: resources.length },
            { id: "horaires", label: t("tabs.horaires") },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "personnel" ? (
          <>
            <ListToolbar
              action={
                <Button
                  onClick={() => setStaffDialogOpen(true)}
                  className="h-9 w-full sm:w-auto"
                >
                  + {t("personnel.add")}
                </Button>
              }
            >
              <input
                type="search"
                placeholder={t("personnel.searchPlaceholder")}
                value={staffQuery}
                onChange={(e) => setStaffQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:max-w-xs"
              />
            </ListToolbar>

            <DataTable
              empty={
                staff.length === 0
                  ? t("personnel.empty")
                  : filteredStaff.length === 0
                    ? t("personnel.noResults")
                    : undefined
              }
            >
              {filteredStaff.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className={`w-10 ${dataTableHead}`} aria-label={t("personnel.columns.color")} />
                      <th className={dataTableHead}>{t("personnel.columns.name")}</th>
                      <th className={dataTableHead}>{t("personnel.columns.email")}</th>
                      <th className={`w-28 text-right ${dataTableHead}`}>
                        {t("personnel.columns.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s) => (
                      <tr key={s.id} className={dataTableRow}>
                        <td className={dataTableCell}>
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: s.color ?? "#64748b" }}
                          />
                        </td>
                        <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                          {s.full_name}
                        </td>
                        <td className={`text-slate-600 ${dataTableCell}`}>
                          {s.email ?? tCommon("dash")}
                        </td>
                        <td className={`text-right ${dataTableCell}`}>
                          <form action={deleteStaffMember}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button variant="ghost" type="submit" className="h-8 text-red-600">
                              {t("personnel.delete")}
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </DataTable>

            {staff.length > 0 ? (
              <ListPanelFooter>
                {t("personnel.footer", { count: filteredStaff.length })}
                {staffQuery.trim()
                  ? ` · ${tCommon("countOfTotal", { count: filteredStaff.length, total: staff.length })}`
                  : ""}
              </ListPanelFooter>
            ) : null}
          </>
        ) : null}

        {tab === "cabines" ? (
          <>
            <ListToolbar
              action={
                <Button
                  onClick={() => setResourceDialogOpen(true)}
                  className="h-9 w-full sm:w-auto"
                >
                  + {t("cabines.add")}
                </Button>
              }
            >
              <span className="text-sm text-slate-500">{t("cabines.subtitle")}</span>
            </ListToolbar>

            <DataTable empty={resources.length === 0 ? t("cabines.empty") : undefined}>
              {resources.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className={dataTableHead}>{t("cabines.columns.name")}</th>
                      <th className={`w-28 text-right ${dataTableHead}`}>
                        {t("cabines.columns.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr key={r.id} className={dataTableRow}>
                        <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                          {r.name}
                        </td>
                        <td className={`text-right ${dataTableCell}`}>
                          <form action={deleteResource}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button variant="ghost" type="submit" className="h-8 text-red-600">
                              {t("cabines.delete")}
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </DataTable>

            {resources.length > 0 ? (
              <ListPanelFooter>
                {t("cabines.footer", { count: resources.length })}
              </ListPanelFooter>
            ) : null}
          </>
        ) : null}

        {tab === "horaires" ? (
          <div className="px-4 py-4 lg:px-6">
            <p className="mb-4 text-sm text-slate-600">{t("horaires.description")}</p>
            <WorkingHoursForm hours={hours} />
          </div>
        ) : null}
      </ListPanel>

      <FormDialog
        open={staffDialogOpen}
        onClose={() => setStaffDialogOpen(false)}
        title={t("personnel.dialogTitle")}
      >
        <StaffForm onSuccess={() => setStaffDialogOpen(false)} />
      </FormDialog>

      <FormDialog
        open={resourceDialogOpen}
        onClose={() => setResourceDialogOpen(false)}
        title={t("cabines.dialogTitle")}
      >
        <ResourceForm onSuccess={() => setResourceDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
