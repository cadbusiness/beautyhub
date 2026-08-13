"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { PaginationControls } from "@/components/ui/pagination";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import type { VoucherTemplateRow } from "@/lib/institut/voucher-pdf";
import { paginateItems } from "@/lib/ui/pagination";
import { formatPrice } from "@/lib/utils";
import { voidVoucherDirect } from "../../caisse-session-actions";
import { IssueVoucherDialog, type IssueDialogSale } from "./issue-voucher-dialog";

export type VoucherKind = "voucher" | "gift_card" | "credit_note";
export type VoucherSource = "unified" | "legacy_gift_card" | "legacy_credit_note";

export type UnifiedVoucherRow = {
  id: string;
  kind: VoucherKind;
  source: VoucherSource;
  code: string;
  balance_cents: number;
  initial_cents: number;
  status: string;
  recipient_or_reason: string | null;
  created_at: string;
  expires_at: string | null;
};

const LIST_PAGE_SIZE = 15;

type TypeFilter = "all" | VoucherKind;
type StatusFilter = "all" | "active" | "depleted" | "cancelled" | "expired";

export function VouchersManager({
  vouchers,
  templates,
  sales,
}: {
  vouchers: UnifiedVoucherRow[];
  templates: VoucherTemplateRow[];
  sales: IssueDialogSale[];
}) {
  const t = useTranslations("pos.vouchers");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [issueOpen, setIssueOpen] = useState(false);

  const filterKey = `${query.trim().toLowerCase()}|${typeFilter}|${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (typeFilter !== "all" && v.kind !== typeFilter) return false;
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.code.toLowerCase().includes(q) ||
        (v.recipient_or_reason?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [vouchers, query, typeFilter, statusFilter]);

  const paged = paginateItems(filtered, page, LIST_PAGE_SIZE);
  const emptyMessage =
    vouchers.length === 0 ? t("list.empty") : t("list.noResults");

  return (
    <>
      <ListToolbar
        action={
          <Button
            onClick={() => setIssueOpen(true)}
            className="h-9 w-full sm:w-auto"
          >
            + {t("issueButton")}
          </Button>
        }
        trailing={
          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="h-9 w-40 text-sm"
            >
              <option value="all">{t("filters.allTypes")}</option>
              <option value="voucher">{t("types.voucher")}</option>
              <option value="gift_card">{t("types.gift_card")}</option>
              <option value="credit_note">{t("types.credit_note")}</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 w-36 text-sm"
            >
              <option value="all">{t("filters.allStatus")}</option>
              <option value="active">{t("status.active")}</option>
              <option value="depleted">{t("status.depleted")}</option>
              <option value="cancelled">{t("status.cancelled")}</option>
              <option value="expired">{t("status.expired")}</option>
            </Select>
          </div>
        }
      >
        <Input
          type="search"
          placeholder={t("list.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={`w-32 ${dataTableHeadCompact}`}>{t("columns.type")}</th>
              <th className={dataTableHeadCompact}>{t("columns.code")}</th>
              <th className={dataTableHeadCompact}>{t("columns.balance")}</th>
              <th className={`hidden md:table-cell ${dataTableHeadCompact}`}>
                {t("columns.recipient")}
              </th>
              <th className={`w-28 ${dataTableHeadCompact}`}>{t("columns.status")}</th>
              <th className={`hidden w-28 lg:table-cell ${dataTableHeadCompact}`}>
                {t("columns.date")}
              </th>
              <th className={`w-32 text-right ${dataTableHeadCompact}`}>
                {t("columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map((v) => (
              <tr key={`${v.source}:${v.id}`} className={dataTableRow}>
                <td className={dataTableCellCompact}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700">
                      {t(`types.${v.kind}`)}
                    </span>
                    {v.source !== "unified" ? (
                      <span
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
                        title={t("filters.legacyBadge")}
                      >
                        {t("filters.legacyBadge")}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={`font-mono text-slate-900 ${dataTableCellCompact}`}>
                  {v.code}
                </td>
                <td className={`tabular-nums ${dataTableCellCompact}`}>
                  <span className="text-slate-900">{formatPrice(v.balance_cents)}</span>
                  <span className="text-slate-400"> / {formatPrice(v.initial_cents)}</span>
                </td>
                <td className={`hidden text-slate-600 md:table-cell ${dataTableCellCompact}`}>
                  {v.recipient_or_reason ?? tCommon("dash")}
                </td>
                <td className={dataTableCellCompact}>
                  <StatusBadge status={v.status} label={t(`status.${v.status as "active"}`)} />
                </td>
                <td
                  className={`hidden whitespace-nowrap text-slate-500 lg:table-cell ${dataTableCellCompact}`}
                >
                  {format.dateTime(new Date(v.created_at), { dateStyle: "short" })}
                </td>
                <td className={`text-right ${dataTableCellCompact}`}>
                  <RowActions>
                    {v.source === "unified" ? (
                      <Link
                        href={`/institut/caisse/bons/voucher/${v.id}`}
                        target="_blank"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      >
                        {t("openVoucher")}
                      </Link>
                    ) : null}
                    {v.source === "unified" && v.status === "active" ? (
                      <form action={voidVoucherDirect}>
                        <input type="hidden" name="voucher_id" value={v.id} />
                        <RowActionButton type="submit" tone="danger">
                          {t("voidVoucher")}
                        </RowActionButton>
                      </form>
                    ) : null}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {paged.total > 0 ? (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-400 lg:px-6">
          <span>
            {tCommon("countOfTotal", {
              count: paged.to - paged.from + 1,
              total: paged.total,
            })}
          </span>
          <PaginationControls
            page={paged.page}
            totalPages={paged.totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      {issueOpen ? (
        <IssueVoucherDialog
          open={issueOpen}
          onClose={() => setIssueOpen(false)}
          templates={templates}
          sales={sales}
        />
      ) : null}
    </>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "depleted"
        ? "bg-slate-100 text-slate-600"
        : status === "cancelled"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}
