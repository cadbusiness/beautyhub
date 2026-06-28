"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { paginateItems } from "@/lib/ui/pagination";
import type { SubscriptionListRow } from "@/lib/platform/subscriptions";
import { setSubscriptionStatus, setTenantPlan } from "../actions";

const STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
const PAGE_SIZE = 12;

export function SubscriptionsManager({
  subscriptions,
  plans,
}: {
  subscriptions: SubscriptionListRow[];
  plans: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.subscriptions");
  const [filter, setFilter] = useState<(typeof STATUSES)[number] | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "all") return subscriptions;
    return subscriptions.filter((s) => s.status === filter);
  }, [subscriptions, filter]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  return (
    <ListPanel>
      <ListToolbar>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as (typeof STATUSES)[number] | "all")}
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
              <th className={dataTableHead}>{t("columns.tenant")}</th>
              <th className={dataTableHead}>{t("columns.plan")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={`w-36 ${dataTableHead}`}>{t("columns.periodEnd")}</th>
              <th className={`w-48 ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {slice.items.map((sub) => (
              <tr key={sub.id} className={dataTableRow}>
                <td className={dataTableCell}>
                  <Link
                    href={`/admin/tenants/${sub.tenantId}`}
                    className="font-medium text-slate-900 hover:text-slate-600"
                  >
                    {sub.tenantName}
                  </Link>
                  <p className="text-xs text-slate-500">{sub.tenantSlug}</p>
                </td>
                <td className={`text-slate-500 ${dataTableCell}`}>{sub.planName}</td>
                <td className={dataTableCell}>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {t(`status.${sub.status}`)}
                  </span>
                </td>
                <td className={`text-slate-500 ${dataTableCell}`}>
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className={dataTableCell}>
                  <div className="flex flex-col gap-2">
                    <form action={setTenantPlan} className="flex items-center gap-1">
                      <input type="hidden" name="tenant_id" value={sub.tenantId} />
                      <Select name="plan_id" defaultValue={sub.planId ?? ""} className="h-8 text-xs">
                        <option value="">{t("noPlan")}</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="outline" className="h-8 shrink-0 text-xs">
                        {t("applyPlan")}
                      </Button>
                    </form>
                    <form action={setSubscriptionStatus} className="flex items-center gap-1">
                      <input type="hidden" name="tenant_id" value={sub.tenantId} />
                      <Select name="status" defaultValue={sub.status} className="h-8 text-xs">
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`status.${status}`)}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="outline" className="h-8 shrink-0 text-xs">
                        {t("applyStatus")}
                      </Button>
                    </form>
                  </div>
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
  );
}
