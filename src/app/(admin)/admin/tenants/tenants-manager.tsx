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
import { paginateItems } from "@/lib/ui/pagination";
import type { TenantListRow } from "@/lib/platform/tenants";
import { CreateTenantForm } from "./create-tenant-form";

const PAGE_SIZE = 12;

const SUBSCRIPTION_STATUS_KEYS = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
} as const;

function SubscriptionStatusBadge({
  status,
  label,
}: {
  status: string | null;
  label: string;
}) {
  if (!status) return <>—</>;
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {label}
    </span>
  );
}

export function TenantsManager({
  tenants,
  plans,
  brandFilter,
}: {
  tenants: TenantListRow[];
  plans: { id: string; name: string }[];
  brandFilter?: string;
}) {
  const t = useTranslations("admin.tenants");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(q) ||
        tenant.slug.toLowerCase().includes(q) ||
        tenant.brandName.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  const slice = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, brandFilter]);

  const emptyMessage = tenants.length === 0 ? t("empty") : t("noResults");

  return (
    <>
      <ListPanel>
        {brandFilter ? (
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 lg:px-6">
            {t("brandFilterHint")}{" "}
            <Link href="/admin/tenants" className="font-medium text-slate-700 hover:underline">
              {t("clearBrandFilter")}
            </Link>
          </div>
        ) : null}

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
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.institut")}</th>
                <th className={dataTableHead}>{t("columns.slug")}</th>
                <th className={dataTableHead}>{t("columns.brand")}</th>
                <th className={dataTableHead}>{t("columns.plan")}</th>
                <th className={`w-28 ${dataTableHead}`}>{t("columns.subscription")}</th>
                <th className={`w-32 ${dataTableHead}`}>{t("columns.activeModules")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((tenant) => (
                <tr key={tenant.id} className={dataTableRow}>
                  <td className={dataTableCell}>
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="font-medium text-slate-900 hover:text-slate-600"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.slug}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.brandName}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.planName}</td>
                  <td className={dataTableCell}>
                    <SubscriptionStatusBadge
                      status={tenant.subscriptionStatus}
                      label={
                        tenant.subscriptionStatus &&
                        tenant.subscriptionStatus in SUBSCRIPTION_STATUS_KEYS
                          ? t(
                              `subscriptionStatus.${tenant.subscriptionStatus}` as
                                | "subscriptionStatus.active"
                                | "subscriptionStatus.trialing"
                                | "subscriptionStatus.past_due"
                                | "subscriptionStatus.canceled",
                            )
                          : (tenant.subscriptionStatus ?? "—")
                      }
                    />
                  </td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.activeModules}</td>
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
          <CreateTenantForm plans={plans} onSuccess={() => setDialogOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
}
