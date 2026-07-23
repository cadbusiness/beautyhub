"use client";

import { Ban, Copy, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { resendTeamInvitation, revokeTeamInvitation } from "../actions";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import type { TeamInvitation, TeamMember } from "@/lib/institut/team-access";
import { formatDateTime } from "@/lib/utils";

function inviteUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/invite/${token}`;
  }
  return `/invite/${token}`;
}

export function TeamAccessPanel({
  members,
  invitations,
}: {
  members: TeamMember[];
  invitations: TeamInvitation[];
}) {
  const t = useTranslations("institut.team.access");
  const tCommon = useTranslations("common");

  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-2.5 lg:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("membersTitle")}
        </h2>
      </div>
      <DataTable empty={members.length === 0 ? t("noMembers") : undefined}>
        {members.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHeadCompact}>{t("columns.name")}</th>
                <th className={dataTableHeadCompact}>{t("columns.role")}</th>
                <th className={dataTableHeadCompact}>{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membership_id} className={dataTableRow}>
                  <td className={dataTableCellCompact}>
                    {m.full_name ?? tCommon("dash")}
                  </td>
                  <td className={dataTableCellCompact}>
                    {m.tenant_role_name ?? m.role}
                  </td>
                  <td className={dataTableCellCompact}>{t("statusActive")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DataTable>

      <div className="border-b border-t border-slate-200 px-4 py-2.5 lg:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("invitationsTitle")}
        </h2>
      </div>
      <DataTable empty={pending.length === 0 ? t("noInvitations") : undefined}>
        {pending.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHeadCompact}>{t("columns.email")}</th>
                <th className={dataTableHeadCompact}>{t("columns.role")}</th>
                <th className={dataTableHeadCompact}>{t("columns.expires")}</th>
                <th className={`text-right ${dataTableHeadCompact}`}>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((inv) => (
                <tr key={inv.id} className={dataTableRow}>
                  <td className={dataTableCellCompact}>
                    <div>
                      <p>{inv.email}</p>
                      {inv.staff_name ? (
                        <p className="text-xs text-slate-500">{inv.staff_name}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className={dataTableCellCompact}>
                    {inv.tenant_role_name ?? inv.membership_role}
                  </td>
                  <td className={dataTableCellCompact}>
                    {formatDateTime(inv.expires_at)}
                  </td>
                  <td className={`text-right ${dataTableCellCompact}`}>
                    <RowActions>
                      <RowActionButton
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(inviteUrl(inv.token))}
                        icon={<Copy className="h-3.5 w-3.5" />}
                      >
                        {t("copyLink")}
                      </RowActionButton>
                      <form action={resendTeamInvitation}>
                        <input type="hidden" name="invitation_id" value={inv.id} />
                        <RowActionButton type="submit" icon={<Send className="h-3.5 w-3.5" />}>
                          {t("resend")}
                        </RowActionButton>
                      </form>
                      <form action={revokeTeamInvitation}>
                        <input type="hidden" name="invitation_id" value={inv.id} />
                        <RowActionButton type="submit" tone="danger" icon={<Ban className="h-3.5 w-3.5" />}>
                          {t("revoke")}
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
      <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 lg:px-6">
        {t("emailComingSoon")}
      </p>
    </>
  );
}
