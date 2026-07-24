"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MailPlus, Pencil, Trash2 } from "lucide-react";
import { deleteStaffMember, deleteResource } from "../actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PageTabs } from "@/components/ui/page-tabs";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import type {
  StaffWithAccess,
  TeamInvitation,
  TeamMember,
  TenantRole,
} from "@/lib/institut/team-access";
import { StaffForm } from "./staff-form";
import { StaffInviteDialog } from "./staff-invite-dialog";
import { TeamAccessPanel } from "./team-access-panel";
import { TeamRolesPanel } from "./team-roles-panel";
import { ResourceForm } from "./resource-form";
import { SchedulesPanel } from "./schedules-panel";
import { ScheduleAssignmentsPanel } from "./schedule-assignments";
import { TimeOffPanel } from "./time-off-panel";

type Tab = "personnel" | "acces" | "roles" | "cabines" | "horaires";
type HorairesTab = "grilles" | "assignations" | "absences";

type StaffRow = StaffWithAccess;

type ResourceRow = {
  id: string;
  name: string;
  schedule_id: string | null;
};

type HourRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

type ScheduleRow = {
  id: string;
  name: string;
  is_default: boolean;
  blocks: HourRow[];
};

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

export function EquipeManager({
  staff,
  roles,
  members,
  invitations,
  resources,
  schedules,
  timeOffs,
}: {
  staff: StaffRow[];
  roles: TenantRole[];
  members: TeamMember[];
  invitations: TeamInvitation[];
  resources: ResourceRow[];
  schedules: ScheduleRow[];
  timeOffs: TimeOffRow[];
}) {
  const t = useTranslations("institut.team");
  const tCommon = useTranslations("common");
  const [tab, setTab] = useState<Tab>("personnel");
  const [horairesTab, setHorairesTab] = useState<HorairesTab>("grilles");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [inviteStaff, setInviteStaff] = useState<StaffRow | null>(null);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);

  const pendingCount = invitations.filter((i) => i.status === "pending").length;

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
            { id: "acces", label: t("tabs.acces"), count: pendingCount || undefined },
            { id: "roles", label: t("tabs.roles"), count: roles.length },
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
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffDialogOpen(true);
                  }}
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
                      <th className={`w-14 ${dataTableHead}`} aria-label={t("personnel.columns.color")} />
                      <th className={dataTableHead}>{t("personnel.columns.name")}</th>
                      <th className={dataTableHead}>{t("personnel.columns.email")}</th>
                      <th className={dataTableHead}>{t("personnel.columns.access")}</th>
                      <th className={`w-40 text-right ${dataTableHead}`}>
                        {t("personnel.columns.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s) => {
                      return (
                        <tr
                          key={s.id}
                          className={`${dataTableRow} cursor-pointer`}
                          onClick={() => {
                            setEditingStaff(s);
                            setStaffDialogOpen(true);
                          }}
                        >
                          <td className={dataTableCell}>
                            <StaffAvatar
                              name={s.full_name}
                              color={s.color}
                              imageUrl={s.avatar_url}
                            />
                          </td>
                          <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                            {s.full_name}
                          </td>
                          <td className={`text-slate-600 ${dataTableCell}`}>
                            {s.email ?? tCommon("dash")}
                          </td>
                          <td className={dataTableCell}>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                s.access_status === "active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : s.access_status === "pending"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {s.access_status === "active"
                                ? t("personnel.accessActive")
                                : s.access_status === "pending"
                                  ? t("personnel.accessPending")
                                  : t("personnel.accessNone")}
                            </span>
                            {s.tenant_role_name ? (
                              <span className="ml-1.5 text-xs text-slate-500">{s.tenant_role_name}</span>
                            ) : null}
                          </td>
                          <td
                            className={`text-right ${dataTableCell}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RowActions>
                              <RowActionButton
                                type="button"
                                iconOnly
                                onClick={() => {
                                  setEditingStaff(s);
                                  setStaffDialogOpen(true);
                                }}
                                icon={<Pencil className="h-3.5 w-3.5" />}
                              >
                                {t("personnel.edit")}
                              </RowActionButton>
                              {s.access_status !== "active" ? (
                                <RowActionButton
                                  type="button"
                                  iconOnly
                                  onClick={() => setInviteStaff(s)}
                                  icon={<MailPlus className="h-3.5 w-3.5" />}
                                >
                                  {t("personnel.invite")}
                                </RowActionButton>
                              ) : null}
                              <form action={deleteStaffMember}>
                                <input type="hidden" name="id" value={s.id} />
                                <RowActionButton
                                  type="submit"
                                  iconOnly
                                  tone="danger"
                                  icon={<Trash2 className="h-3.5 w-3.5" />}
                                >
                                  {t("personnel.delete")}
                                </RowActionButton>
                              </form>
                            </RowActions>
                          </td>
                        </tr>
                      );
                    })}
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

        {tab === "acces" ? (
          <TeamAccessPanel members={members} invitations={invitations} />
        ) : null}

        {tab === "roles" ? <TeamRolesPanel roles={roles} /> : null}

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
          <>
            <PageTabs
              tabs={[
                { id: "grilles", label: t("horairesTabs.grilles") },
                { id: "assignations", label: t("horairesTabs.assignations") },
                { id: "absences", label: t("horairesTabs.absences") },
              ]}
              active={horairesTab}
              onChange={setHorairesTab}
            />

            {horairesTab === "grilles" ? (
              <SchedulesPanel schedules={schedules} />
            ) : null}

            {horairesTab === "assignations" ? (
              <ScheduleAssignmentsPanel
                staff={staff}
                resources={resources}
                schedules={schedules}
              />
            ) : null}

            {horairesTab === "absences" ? (
              <TimeOffPanel
                timeOffs={timeOffs}
                staff={staff.map((s) => ({ id: s.id, full_name: s.full_name }))}
                resources={resources}
              />
            ) : null}
          </>
        ) : null}
      </ListPanel>

      <FormDialog
        open={staffDialogOpen}
        onClose={() => {
          setStaffDialogOpen(false);
          setEditingStaff(null);
        }}
        title={editingStaff ? t("personnel.dialogEditTitle") : t("personnel.dialogTitle")}
        size="lg"
      >
        {staffDialogOpen ? (
          <StaffForm
            staff={editingStaff}
            roles={roles}
            onSuccess={() => {
              setStaffDialogOpen(false);
              setEditingStaff(null);
            }}
            onInviteRequest={
              editingStaff && editingStaff.access_status !== "active"
                ? () => {
                    setInviteStaff(editingStaff);
                    setStaffDialogOpen(false);
                    setEditingStaff(null);
                  }
                : undefined
            }
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={Boolean(inviteStaff)}
        onClose={() => setInviteStaff(null)}
        title={t("access.inviteTitle")}
      >
        {inviteStaff ? (
          <StaffInviteDialog
            staff={inviteStaff}
            roles={roles}
            onSuccess={() => setInviteStaff(null)}
          />
        ) : null}
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
