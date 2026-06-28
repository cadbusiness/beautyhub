"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import type { SupportTicketRow, SupportStatus } from "@/lib/platform/support";
import { updateTicketStatus, type SupportActionResult } from "./actions";

const STATUSES: SupportStatus[] = ["open", "in_progress", "resolved", "closed"];

export function SupportManager({ tickets }: { tickets: SupportTicketRow[] }) {
  const t = useTranslations("admin.support");
  const [filter, setFilter] = useState<SupportStatus | "all">("open");
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [, formAction, pending] = useActionState(updateTicketStatus, {} as SupportActionResult);

  const filtered = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === filter);
  }, [tickets, filter]);

  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <ListPanel className="flex-none">
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
          <thead>
            <tr className={dataTableRow}>
              <th className={dataTableHead}>{t("columns.subject")}</th>
              <th className={dataTableHead}>{t("columns.tenant")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ticket) => (
              <tr
                key={ticket.id}
                className={`${dataTableRow} cursor-pointer ${selected?.id === ticket.id ? "bg-slate-50" : ""}`}
                onClick={() => setSelectedId(ticket.id)}
              >
                <td className={dataTableCell}>
                  <p className="font-medium text-slate-900">{ticket.subject}</p>
                  <p className="text-xs text-slate-500">{t(`category.${ticket.category}`)}</p>
                </td>
                <td className={dataTableCell}>{ticket.tenant?.name ?? "—"}</td>
                <td className={dataTableCell}>{t(`status.${ticket.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </ListPanel>

      {selected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">{selected.subject}</h2>
            <p className="text-xs text-slate-500">
              {selected.tenant?.name} · {new Date(selected.created_at).toLocaleString("fr-FR")}
            </p>
          </div>

          {selected.ai_summary ? (
            <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {selected.ai_summary}
            </p>
          ) : null}

          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t("detail.message")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{selected.body}</p>
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
          </div>

          <form action={formAction} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
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
      ) : null}
    </div>
  );
}
