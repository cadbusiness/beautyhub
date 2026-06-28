"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createSitePage, deleteSitePage } from "./site-actions";
import {
  pagePublicUrl,
  SITE_PAGE_TYPES,
  type SitePageRow,
  type SitePageType,
} from "@/lib/institut/site-pages";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { ListPanel, ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";

export function SitePagesManager({
  pages,
  publicBaseUrl,
}: {
  pages: SitePageRow[];
  publicBaseUrl: string;
}) {
  const t = useTranslations("institut.marketing.website");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  function handleDelete(page: SitePageRow) {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await deleteSitePage(page.id);
      router.refresh();
    });
  }

  function handleCreate(type: SitePageType) {
    startTransition(async () => {
      const res = await createSitePage(type);
      setCreateOpen(false);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (res.id) router.push(`/institut/marketing/page-web/${res.id}/builder`);
      else router.refresh();
    });
  }

  const creatableTypes = SITE_PAGE_TYPES.filter(
    (def) => !pages.some((p) => p.page_type === def.type),
  );

  return (
    <div className="space-y-4 px-4 py-4 lg:px-6">
      <p className="text-sm text-slate-500">{t("description")}</p>
      <p className="text-xs text-slate-400">
        {t("publicBase")}: <span className="font-mono">{publicBaseUrl}</span>
      </p>

      <ListPanel className="flex-none">
        <ListToolbar
          action={
            <Button
              className="h-9 w-full sm:w-auto"
              onClick={() => setCreateOpen((v) => !v)}
              disabled={pending}
            >
              + {t("addPage")}
            </Button>
          }
        >
          <p className="text-sm font-medium text-slate-700">{t("pagesTitle")}</p>
        </ListToolbar>

        {createOpen ? (
          <div className="border-b border-slate-200 px-4 py-3 lg:px-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("chooseType")}
            </p>
            <div className="flex flex-wrap gap-2">
              {creatableTypes.map((def) => {
                return (
                  <button
                    key={def.type}
                    type="button"
                    disabled={pending}
                    onClick={() => handleCreate(def.type)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-300 disabled:opacity-50"
                  >
                    <span className="font-medium text-slate-900">{t(`types.${def.type}`)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {t(`types.${def.type}Desc`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <DataTable>
          <thead>
            <tr className={dataTableRow}>
              <th className={dataTableHead}>{t("columns.title")}</th>
              <th className={dataTableHead}>{t("columns.type")}</th>
              <th className={dataTableHead}>{t("columns.template")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={dataTableHead}>{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className={dataTableRow}>
                <td className={`${dataTableCell} font-medium text-slate-900`}>
                  {page.title}
                  {page.is_home ? (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {t("homeBadge")}
                    </span>
                  ) : null}
                </td>
                <td className={dataTableCell}>{t(`types.${page.page_type}`)}</td>
                <td className={dataTableCell}>{t(`templates.${page.template_id}`)}</td>
                <td className={dataTableCell}>
                  {page.is_published ? t("status.published") : t("status.draft")}
                </td>
                <td className={dataTableCell}>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/institut/marketing/page-web/${page.id}/builder`}
                      className="text-sm text-slate-700 hover:text-slate-900"
                    >
                      {t("editBuilder")}
                    </Link>
                    <a
                      href={pagePublicUrl(publicBaseUrl, page)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      {t("preview")}
                    </a>
                    {!page.is_home ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(page)}
                        disabled={pending}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {tCommon("delete")}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <ListPanelFooter>{t("footer", { count: pages.length })}</ListPanelFooter>
      </ListPanel>
    </div>
  );
}
