"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createSitePage,
  deleteSitePage,
  toggleSitePageNav,
  toggleSitePagePublished,
} from "./site-actions";
import {
  pagePublicUrl,
  SITE_PAGE_TYPES,
  type SitePageRow,
  type SitePageType,
} from "@/lib/institut/site-pages";
import { SitePreviewFrame } from "@/components/site/site-preview-frame";
import { Button } from "@/components/ui/button";

export function SitePagesManager({
  pages,
  publicBaseUrl,
  customDomain,
  homePageId,
}: {
  pages: SitePageRow[];
  publicBaseUrl: string;
  customDomain: string | null;
  homePageId: string | null;
}) {
  const t = useTranslations("institut.marketing.website");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);

  const creatableTypes = SITE_PAGE_TYPES.filter(
    (def) => !pages.some((p) => p.page_type === def.type),
  );

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

  function handleTogglePublished(page: SitePageRow, published: boolean) {
    startTransition(async () => {
      const res = await toggleSitePagePublished(page.id, published);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  function handleToggleNav(page: SitePageRow, showInNav: boolean) {
    startTransition(async () => {
      const res = await toggleSitePageNav(page.id, showInNav);
      if (res.error) alert(res.error);
      else router.refresh();
    });
  }

  const previewSrc = previewPageId
    ? `/institut/marketing/page-web/${previewPageId}/preview`
    : homePageId
      ? `/institut/marketing/page-web/${homePageId}/preview`
      : null;

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">{t("hub.title")}</h2>
            <p className="text-sm text-slate-500">{t("description")}</p>
            <p className="text-xs text-slate-400">
              {t("publicBase")}: <span className="font-mono">{publicBaseUrl}</span>
            </p>
            {customDomain ? (
              <p className="text-xs text-slate-400">
                {t("customDomain")}:{" "}
                <span className="font-mono">https://{customDomain}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/institut/marketing/page-web/theme"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t("hub.themeLink")}
            </Link>
            {homePageId ? (
              <Link
                href={`/institut/marketing/page-web/${homePageId}/builder`}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                {t("hub.editHome")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {previewSrc ? (
        <SitePreviewFrame
          src={previewSrc}
          title={t("hub.sitePreview")}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{t("pagesTitle")}</h3>
          <Button
            className="h-9"
            onClick={() => setCreateOpen((v) => !v)}
            disabled={pending || creatableTypes.length === 0}
          >
            + {t("addPage")}
          </Button>
        </div>

        {createOpen && creatableTypes.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("chooseType")}
            </p>
            <div className="flex flex-wrap gap-2">
              {creatableTypes.map((def) => (
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
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {pages.map((page) => (
            <article
              key={page.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-slate-900">
                    {page.title}
                    {page.is_home ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {t("homeBadge")}
                      </span>
                    ) : null}
                  </h4>
                  <p className="text-xs text-slate-500">{t(`types.${page.page_type}`)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    page.is_published
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {page.is_published ? t("status.published") : t("status.draft")}
                </span>
              </div>

              <div className="mb-4 space-y-2 border-t border-slate-100 pt-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{t("toggles.published")}</span>
                  <input
                    type="checkbox"
                    checked={page.is_published}
                    disabled={pending}
                    onChange={(e) => handleTogglePublished(page, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </label>
                {!page.is_home ? (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">{t("toggles.showInNav")}</span>
                    <input
                      type="checkbox"
                      checked={page.show_in_nav}
                      disabled={pending || !page.is_published}
                      onChange={(e) => handleToggleNav(page, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Link
                  href={`/institut/marketing/page-web/${page.id}/builder`}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  {t("editBuilder")}
                </Link>
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:text-slate-900"
                  onClick={() => setPreviewPageId(page.id)}
                >
                  {t("previewBtn")}
                </button>
                <a
                  href={`/institut/marketing/page-web/${page.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  {t("previewFull")}
                </a>
                {page.is_published ? (
                  <a
                    href={pagePublicUrl(publicBaseUrl, page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    {t("viewLive")}
                  </a>
                ) : null}
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
            </article>
          ))}
        </div>

        <p className="text-xs text-slate-400">{t("footer", { count: pages.length })}</p>
      </section>

      {previewPageId && previewPageId !== homePageId ? (
        <SitePreviewFrame
          src={`/institut/marketing/page-web/${previewPageId}/preview`}
          title={t("previewPage")}
        />
      ) : null}
    </div>
  );
}
