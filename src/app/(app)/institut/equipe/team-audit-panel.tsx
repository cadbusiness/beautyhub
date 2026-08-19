"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatDateTime } from "@/lib/utils";
import type { TeamAuditLogRow } from "@/lib/institut/team-audit";

const KNOWN_ACTIONS = [
  "staff.created",
  "staff.updated",
  "staff.archived",
  "staff.restored",
  "staff.deleted",
  "staff.activated",
  "staff.password_reset",
  "staff.invited",
  "invitation.resent",
  "invitation.revoked",
  "role.created",
  "role.updated",
  "role.deleted",
  "client.anonymized",
  "client.data_export",
] as const;

export function TeamAuditPanel({ logs }: { logs: TeamAuditLogRow[] }) {
  const t = useTranslations("institut.team.journal");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((row) => {
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (!q) return true;
      const hay = [
        row.actor_email ?? "",
        row.action,
        row.resource_type,
        String(row.metadata.full_name ?? ""),
        String(row.metadata.email ?? ""),
        String(row.metadata.name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query, actionFilter]);

  function actionLabel(action: string): string {
    const key = action.replaceAll(".", "_");
    const messages: Record<string, string> = {
      staff_created: t("actions.staff_created"),
      staff_updated: t("actions.staff_updated"),
      staff_archived: t("actions.staff_archived"),
      staff_restored: t("actions.staff_restored"),
      staff_deleted: t("actions.staff_deleted"),
      staff_activated: t("actions.staff_activated"),
      staff_password_reset: t("actions.staff_password_reset"),
      staff_invited: t("actions.staff_invited"),
      invitation_resent: t("actions.invitation_resent"),
      invitation_revoked: t("actions.invitation_revoked"),
      role_created: t("actions.role_created"),
      role_updated: t("actions.role_updated"),
      role_deleted: t("actions.role_deleted"),
      client_anonymized: t("actions.client_anonymized"),
      client_data_export: t("actions.client_data_export"),
    };
    return messages[key] ?? action;
  }

  function targetLabel(row: TeamAuditLogRow): string {
    const name = row.metadata.full_name ?? row.metadata.name ?? row.metadata.email;
    if (typeof name === "string" && name.trim()) return name;
    return row.resource_type;
  }

  return (
    <>
      <ListToolbar>
        <div className="flex w-full flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="all">{t("allActions")}</option>
            {KNOWN_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>
        </div>
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? t("empty") : undefined}>
        {filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.when")}</th>
                <th className={dataTableHead}>{t("columns.who")}</th>
                <th className={dataTableHead}>{t("columns.action")}</th>
                <th className={dataTableHead}>{t("columns.target")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={dataTableRow}>
                  <td className={`whitespace-nowrap text-slate-600 ${dataTableCell}`}>
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className={dataTableCell}>{row.actor_email ?? "—"}</td>
                  <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                    {actionLabel(row.action)}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>{targetLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>

      {logs.length > 0 ? (
        <ListPanelFooter>{t("footer", { count: filtered.length })}</ListPanelFooter>
      ) : null}
    </>
  );
}
