"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { CreateTenantForm } from "./create-tenant-form";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  planName: string;
  activeModules: number;
}

export function TenantsManager({
  tenants,
  plans,
}: {
  tenants: TenantRow[];
  plans: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.tenants");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (tenant) => tenant.name.toLowerCase().includes(q) || tenant.slug.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  const emptyMessage = tenants.length === 0 ? t("empty") : t("noResults");

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
            className="h-9 sm:max-w-sm"
          />
        </ListToolbar>

        <DataTable empty={filtered.length === 0 ? emptyMessage : undefined}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={dataTableHead}>{t("columns.institut")}</th>
                <th className={dataTableHead}>{t("columns.slug")}</th>
                <th className={dataTableHead}>{t("columns.plan")}</th>
                <th className={`w-32 ${dataTableHead}`}>{t("columns.activeModules")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
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
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.planName}</td>
                  <td className={`text-slate-500 ${dataTableCell}`}>{tenant.activeModules}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </ListPanel>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("dialogTitle")}
        size="lg"
      >
        <CreateTenantForm plans={plans} onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
