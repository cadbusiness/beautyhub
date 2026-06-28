"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { formatPrice } from "@/lib/utils";
import { paginateItems } from "@/lib/ui/pagination";
import { PlanForm } from "./plan-form";

const PAGE_SIZE = 12;

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  interval: string;
  modules: string[];
  is_active: boolean;
};

export function PlansManager({
  plans,
  modules,
}: {
  plans: PlanRow[];
  modules: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.plans");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, query]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const emptyMessage = plans.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListPanel>
        <ListToolbar
          action={
            <Button onClick={() => setDialogOpen(true)} className="h-9 w-full sm:w-auto">
              + {t("new")}
            </Button>
          }
        >
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 sm:max-w-xs"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.plan")}</th>
                <th className={`w-32 ${dataTableHead}`}>{t("columns.price")}</th>
                <th className={dataTableHead}>{t("columns.modules")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((p) => (
                <tr key={p.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <Link
                      href={`/admin/plans/${p.id}`}
                      className="font-medium text-slate-900 hover:text-slate-600"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>
                    {formatPrice(p.price_cents)}/
                    {p.interval === "year" ? tCommon("perYear") : tCommon("perMonth")}
                  </td>
                  <td className={`max-w-0 truncate text-slate-500 ${dataTableCell}`}>
                    {p.modules.join(", ") || tCommon("dash")}
                  </td>
                  <td className={dataTableCell}>
                    <span
                      className={
                        p.is_active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                      }
                    >
                      {p.is_active ? t("active") : t("inactive")}
                    </span>
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

      {dialogOpen ? (
        <FormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={t("dialogTitle")}
          size="lg"
        >
          <PlanForm modules={modules} onSuccess={() => setDialogOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
}
