"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import type { PlatformTeamRow } from "@/lib/platform/team";
import { invitePlatformAdmin, revokePlatformAdmin, type ActionResult } from "../actions";

const initial: ActionResult = {};

export function TeamManager({
  members,
  currentUserId,
}: {
  members: PlatformTeamRow[];
  currentUserId: string;
}) {
  const t = useTranslations("admin.team");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(invitePlatformAdmin, initial);

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + {t("invite")}
            </Button>
          }
        >
          <span />
        </ListToolbar>

        <DataTable empty={members.length === 0 ? t("empty") : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.email")}</th>
                <th className={`w-40 ${dataTableHead}`}>{t("columns.since")}</th>
                <th className={`w-32 ${dataTableHead}`} />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.membershipId} className={dataTableRow}>
                  <td className={dataTableCell}>{member.email}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>
                    {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className={dataTableCell}>
                    {member.userId === currentUserId ? (
                      <span className="text-xs text-slate-400">{t("you")}</span>
                    ) : (
                      <form action={revokePlatformAdmin}>
                        <input type="hidden" name="membership_id" value={member.membershipId} />
                        <input type="hidden" name="user_id" value={member.userId} />
                        <Button type="submit" variant="outline" className="h-8 text-xs">
                          {t("revoke")}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {members.length > 0 ? (
          <ListPanelFooter>{t("footerCount", { count: members.length })}</ListPanelFooter>
        ) : null}
      </ListPanel>

      {dialogOpen ? (
        <FormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("dialogTitle")}>
          <form action={formAction} className="space-y-4">
            <Field label={t("form.email")} htmlFor="email">
              <Input id="email" name="email" type="email" required placeholder="admin@example.com" />
            </Field>
            <Field label={t("form.password")} htmlFor="password">
              <Input id="password" name="password" type="password" required minLength={6} />
            </Field>
            {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
            {state.ok ? <p className="text-sm text-emerald-600">{state.message}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? t("form.submitting") : t("form.submit")}
            </Button>
          </form>
        </FormDialog>
      ) : null}
    </>
  );
}
