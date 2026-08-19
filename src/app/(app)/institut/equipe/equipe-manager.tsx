"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Archive, MailPlus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { deleteStaffMember, restoreStaffMember, deleteResource } from "../actions";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PageTabs } from "@/components/ui/page-tabs";
import { RowActionsMenu, RowActionsMenuItem } from "@/components/ui/row-actions";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import type {
  StaffWithAccess,
  TeamInvitation,
  TeamMember,
  TenantRole,
} from "@/lib/institut/team-access";
import type { TeamCapabilities } from "@/lib/institut/permissions";
import type { TeamAuditLogRow } from "@/lib/institut/team-audit";
import { StaffForm } from "./staff-form";
import { StaffInviteDialog } from "./staff-invite-dialog";
import { StaffArchiveDialog } from "./staff-archive-dialog";
import { TeamAccessPanel } from "./team-access-panel";
import { TeamRolesPanel } from "./team-roles-panel";
import { ResourceForm } from "./resource-form";
import { SchedulesPanel } from "./schedules-panel";
import { ScheduleAssignmentsPanel } from "./schedule-assignments";
import { TimeOffPanel } from "./time-off-panel";
import { TeamAuditPanel } from "./team-audit-panel";

type Tab = "personnel" | "acces" | "roles" | "journal" | "cabines" | "horaires";
type HorairesTab = "grilles" | "assignations" | "absences";
type PersonnelView = "active" | "archived";

type StaffRow = StaffWithAccess;

type ResourceRow = {
  id: string;
  name: string;
  kind?: string | null;
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
  canHardDeleteByStaffId,
  capabilities,
  auditLogs,
}: {
  staff: StaffRow[];
  roles: TenantRole[];
  members: TeamMember[];
  invitations: TeamInvitation[];
  resources: ResourceRow[];
  schedules: ScheduleRow[];
  timeOffs: TimeOffRow[];
  canHardDeleteByStaffId: Record<string, boolean>;
  capabilities: TeamCapabilities;
  auditLogs: TeamAuditLogRow[];
}) {
  const t = useTranslations("institut.team");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("personnel");
  const [horairesTab, setHorairesTab] = useState<HorairesTab>("grilles");
  const [personnelView, setPersonnelView] = useState<PersonnelView>("active");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [inviteStaff, setInviteStaff] = useState<StaffRow | null>(null);
  const [archiveStaff, setArchiveStaff] = useState<StaffRow | null>(null);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [rowPending, startRowTransition] = useTransition();

  const pendingCount = invitations.filter((i) => i.status === "pending").length;

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active), [staff]);
  const archivedStaff = useMemo(() => staff.filter((s) => !s.is_active), [staff]);
  const sourceStaff = personnelView === "active" ? activeStaff : archivedStaff;

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return sourceStaff;
    return sourceStaff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false),
    );
  }, [sourceStaff, staffQuery]);

  const isArchivedView = personnelView === "archived";

  function runRestore(id: string) {
    startRowTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await restoreStaffMember({}, fd);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  function runHardDelete(id: string) {
    if (!window.confirm(t("personnel.hardDeleteConfirm"))) return;
    startRowTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteStaffMember({}, fd);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <ListPanel>
        <PageTabs
          tabs={[
            {
              id: "personnel",
              label: t("tabs.personnel"),
              count: activeStaff.length,
            },
            { id: "acces", label: t("tabs.acces"), count: pendingCount || undefined },
            { id: "roles", label: t("tabs.roles"), count: roles.length },
            ...(capabilities.canReadAudit
              ? [{ id: "journal" as const, label: t("tabs.journal") }]
              : []),
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
                !isArchivedView ? (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {capabilities.canManageRoles ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full sm:w-auto"
                        onClick={() => setTab("roles")}
                      >
                        {t("personnel.manageRoles")}
                      </Button>
                    ) : null}
                    {capabilities.canWriteTeam ? (
                      <Button
                        onClick={() => {
                          setEditingStaff(null);
                          setStaffDialogOpen(true);
                        }}
                        className="h-9 w-full sm:w-auto"
                      >
                        + {t("personnel.add")}
                      </Button>
                    ) : null}
                  </div>
                ) : null
              }
            >
              <div className="flex w-full flex-wrap items-center gap-2 sm:flex-nowrap">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonnelView("active");
                      setStaffQuery("");
                    }}
                    className={`h-8 rounded-md px-3 font-medium transition-colors ${
                      personnelView === "active"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t("personnel.viewActive")}{" "}
                    <span className="tabular-nums opacity-70">{activeStaff.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonnelView("archived");
                      setStaffQuery("");
                    }}
                    className={`h-8 rounded-md px-3 font-medium transition-colors ${
                      personnelView === "archived"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t("personnel.viewArchived")}{" "}
                    <span className="tabular-nums opacity-70">{archivedStaff.length}</span>
                  </button>
                </div>
                <input
                  type="search"
                  placeholder={t("personnel.searchPlaceholder")}
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:max-w-xs"
                />
              </div>
            </ListToolbar>

            <DataTable
              empty={
                sourceStaff.length === 0
                  ? isArchivedView
                    ? t("personnel.emptyArchived")
                    : t("personnel.empty")
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
                      <th className={dataTableHead}>
                        {isArchivedView
                          ? t("personnel.columns.status")
                          : t("personnel.columns.access")}
                      </th>
                      <th className={`w-40 text-right ${dataTableHead}`}>
                        {t("personnel.columns.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s) => {
                      const archived = !s.is_active;
                      const canHard = canHardDeleteByStaffId[s.id] ?? false;
                      return (
                        <tr
                          key={s.id}
                          className={`${dataTableRow} cursor-pointer ${archived ? "opacity-60" : ""}`}
                          onClick={() => {
                            if (archived) return;
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
                            {archived ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {t("personnel.archivedBadge")}
                              </span>
                            ) : (
                              <>
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
                                  <span className="ml-1.5 text-xs text-slate-500">
                                    {s.tenant_role_name}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td
                            className={`text-right ${dataTableCell}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-end">
                              <RowActionsMenu label={t("personnel.actionsMenuLabel")}>
                                    {archived ? (
                                  <>
                                    {capabilities.canManageAccess ? (
                                      <RowActionsMenuItem
                                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                                        onSelect={() => runRestore(s.id)}
                                        disabled={rowPending}
                                      >
                                        {t("personnel.restore")}
                                      </RowActionsMenuItem>
                                    ) : null}
                                    {capabilities.canManageAccess ? (
                                      <RowActionsMenuItem
                                        icon={<Trash2 className="h-3.5 w-3.5" />}
                                        tone="danger"
                                        onSelect={() => runHardDelete(s.id)}
                                        disabled={!canHard || rowPending}
                                        title={
                                          canHard
                                            ? t("personnel.hardDelete")
                                            : t("personnel.hardDeleteBlockedTooltip")
                                        }
                                      >
                                        {t("personnel.hardDelete")}
                                      </RowActionsMenuItem>
                                    ) : null}
                                  </>
                                ) : (
                                  <>
                                    <RowActionsMenuItem
                                      icon={<Pencil className="h-3.5 w-3.5" />}
                                      onSelect={() => {
                                        setEditingStaff(s);
                                        setStaffDialogOpen(true);
                                      }}
                                    >
                                      {t("personnel.edit")}
                                    </RowActionsMenuItem>
                                    {s.access_status !== "active" && capabilities.canManageAccess ? (
                                      <RowActionsMenuItem
                                        icon={<MailPlus className="h-3.5 w-3.5" />}
                                        onSelect={() => setInviteStaff(s)}
                                      >
                                        {t("personnel.invite")}
                                      </RowActionsMenuItem>
                                    ) : null}
                                    {capabilities.canManageAccess ? (
                                      <RowActionsMenuItem
                                        icon={<Archive className="h-3.5 w-3.5" />}
                                        tone="danger"
                                        onSelect={() => setArchiveStaff(s)}
                                      >
                                        {t("personnel.archive")}
                                      </RowActionsMenuItem>
                                    ) : null}
                                  </>
                                )}
                              </RowActionsMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </DataTable>

            {sourceStaff.length > 0 ? (
              <ListPanelFooter>
                {t("personnel.footer", { count: filteredStaff.length })}
                {staffQuery.trim()
                  ? ` · ${tCommon("countOfTotal", { count: filteredStaff.length, total: sourceStaff.length })}`
                  : ""}
              </ListPanelFooter>
            ) : null}
          </>
        ) : null}

        {tab === "acces" ? (
          <TeamAccessPanel
            members={members}
            invitations={invitations}
            canManageAccess={capabilities.canManageAccess}
          />
        ) : null}

        {tab === "roles" ? (
          <TeamRolesPanel roles={roles} canManage={capabilities.canManageRoles} />
        ) : null}

        {tab === "journal" && capabilities.canReadAudit ? (
          <TeamAuditPanel logs={auditLogs} />
        ) : null}

        {tab === "cabines" ? (
          <>
            <ListToolbar
              action={
                capabilities.canWriteTeam ? (
                  <Button
                    onClick={() => setResourceDialogOpen(true)}
                    className="h-9 w-full sm:w-auto"
                  >
                    + {t("cabines.add")}
                  </Button>
                ) : null
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
                      <th className={dataTableHead}>{t("cabines.columns.kind")}</th>
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
                        <td className={`text-slate-600 ${dataTableCell}`}>
                          {r.kind === "event" ? t("cabines.kinds.event") : t("cabines.kinds.cabin")}
                        </td>
                        <td className={`text-right ${dataTableCell}`}>
                          {capabilities.canWriteTeam ? (
                            <form action={deleteResource}>
                              <input type="hidden" name="id" value={r.id} />
                              <Button variant="ghost" type="submit" className="h-8 text-red-600">
                                {t("cabines.delete")}
                              </Button>
                            </form>
                          ) : null}
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
                staff={activeStaff}
                resources={resources}
                schedules={schedules}
              />
            ) : null}

            {horairesTab === "absences" ? (
              <TimeOffPanel
                timeOffs={timeOffs}
                staff={activeStaff.map((s) => ({ id: s.id, full_name: s.full_name }))}
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
            canManageAccess={capabilities.canManageAccess}
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
        open={Boolean(archiveStaff)}
        onClose={() => setArchiveStaff(null)}
        title={t("personnel.archiveDialogTitle")}
      >
        {archiveStaff ? (
          <StaffArchiveDialog
            staff={archiveStaff}
            onSuccess={() => {
              setArchiveStaff(null);
              router.refresh();
            }}
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
