"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { paginateItems } from "@/lib/ui/pagination";
import type { SupportTicketRow, SupportStatus } from "@/lib/platform/support";
import { updateTicketStatus, type SupportActionResult } from "./actions";

const STATUSES: SupportStatus[] = ["open", "in_progress", "resolved", "closed"];
const PAGE_SIZE = 12;

export function SupportManager({ tickets }: { tickets: SupportTicketRow[] }) {
  const t = useTranslations("admin.support");
  const [filter, setFilter] = useState<SupportStatus | "all">("open");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [, formAction, pending] = useActionState(updateTicketStatus, {} as SupportActionResult);

  const filtered = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === filter);
  }, [tickets, filter]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  return (
    <>
      <ListPanel>
        <ListToolbar>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SupportStatus | "all")}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">{t("filterAll")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? t("empty") : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.subject")}</th>
                <th className={dataTableHead}>{t("columns.tenant")}</th>
                <th className={dataTableHead}>{t("columns.status")}</th>
                <th className={`w-36 ${dataTableHead}`}>{t("columns.date")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`${dataTableRow} cursor-pointer hover:bg-slate-50`}
                  onClick={() => setSelected(ticket)}
                >
                  <td className={dataTableCell}>
                    <p className="font-medium text-slate-900">{ticket.subject}</p>
                    <p className="text-xs text-slate-500">{t(`category.${ticket.category}`)}</p>
                  </td>
                  <td className={dataTableCell}>{ticket.tenant?.name ?? "—"}</td>
                  <td className={dataTableCell}>{t(`status.${ticket.status}`)}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>
                    {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        {filtered.length > 0 ? (
          <ListPanelFooter
            pagination={{
              page: slice.page,
              totalPages: slice.totalPages,
              onPageChange: setPage,
            }}
          >
            {t("footerCount", { count: slice.total })}
          </ListPanelFooter>
        ) : null}
      </ListPanel>

      {selected ? (
        <FormDialog
          open
          onClose={() => setSelected(null)}
          title={selected.subject}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              {selected.tenant?.name} · {new Date(selected.created_at).toLocaleString("fr-FR")}
            </p>

            {selected.ai_summary ? (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                {selected.ai_summary}
              </p>
            ) : null}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("detail.message")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.body}</p>
            </div>

            {selected.conversation_excerpt ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {t("detail.conversation")}
                </p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  {selected.conversation_excerpt}
                </pre>
              </div>
            ) : null}

            {selected.page_url ? (
              <p className="text-xs text-slate-500">
                {t("detail.page")}: {selected.page_url}
              </p>
            ) : null}

            <form action={formAction} className="space-y-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="ticket_id" value={selected.id} />
              <label className="block text-sm font-medium text-slate-700" htmlFor="status">
                {t("detail.status")}
              </label>
              <select
                id="status"
                name="status"
                defaultValue={selected.status}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-slate-700" htmlFor="admin_notes">
                {t("detail.notes")}
              </label>
              <textarea
                id="admin_notes"
                name="admin_notes"
                defaultValue={selected.admin_notes ?? ""}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />

              <Button type="submit" disabled={pending}>
                {pending ? t("detail.saving") : t("detail.save")}
              </Button>
            </form>
          </div>
        </FormDialog>
      ) : null}
    </>
  );
}
