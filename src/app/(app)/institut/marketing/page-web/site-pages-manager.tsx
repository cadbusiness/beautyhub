"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  applyPageLayout,
  createSitePage,
  deleteSitePage,
  toggleSitePageNav,
  toggleSitePagePublished,
} from "./site-actions";
import { SiteWebSubNav } from "./site-web-sub-nav";
import {
  getLayoutDef,
  layoutsForPageType,
} from "@/lib/institut/site-page-layouts";
import {
  pagePublicUrl,
  SITE_PAGE_TYPES,
  type SitePageRow,
  type SitePageType,
} from "@/lib/institut/site-pages";
import { SiteLayoutPickerCard, SitePageThumbnail } from "@/components/site/site-page-thumbnail";
import { Button } from "@/components/ui/button";

export function SitePagesManager({
  pages,
  publicBaseUrl,
  customDomain,
}: {
  pages: SitePageRow[];
  publicBaseUrl: string;
  customDomain: string | null;
  homePageId?: string | null;
}) {
  const t = useTranslations("institut.marketing.website");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [layoutPickerPageId, setLayoutPickerPageId] = useState<string | null>(null);

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

  function handleApplyLayout(page: SitePageRow, layoutId: string) {
    if (page.layout_id === layoutId) return;
    if (!confirm(t("layoutChangeConfirm"))) return;
    startTransition(async () => {
      const res = await applyPageLayout(page.id, layoutId, true);
      if (res.error) alert(res.error);
      else {
        setLayoutPickerPageId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5 px-4 py-4 lg:px-6">
      <SiteWebSubNav />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-semibold text-slate-900">{t("hub.title")}</h2>
            <p className="truncate text-xs text-slate-400">
              {t("publicBase")}: <span className="font-mono">{publicBaseUrl}</span>
              {customDomain ? (
                <>
                  {" · "}
                  <span className="font-mono">https://{customDomain}</span>
                </>
              ) : null}
            </p>
          </div>
          <Button
            className="h-8 shrink-0 px-3 text-sm"
            onClick={() => setCreateOpen((v) => !v)}
            disabled={pending || creatableTypes.length === 0}
          >
            + {t("addPage")}
          </Button>
        </div>

        {createOpen && creatableTypes.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">{t("chooseType")}</p>
            <div className="flex flex-wrap gap-2">
              {creatableTypes.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  disabled={pending}
                  onClick={() => handleCreate(def.type)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm hover:border-slate-300 disabled:opacity-50"
                >
                  <span className="font-medium text-slate-900">{t(`types.${def.type}`)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="grid gap-4 lg:grid-cols-2">
          {pages.map((page) => {
            const layout = getLayoutDef(page.page_type, page.layout_id);
            const layoutOpen = layoutPickerPageId === page.id;

            return (
              <li
                key={page.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="flex gap-3 p-3">
                  <Link
                    href={`/institut/marketing/page-web/${page.id}/builder`}
                    className="w-[88px] shrink-0 hover:opacity-90 sm:w-[96px]"
                  >
                    <SitePageThumbnail
                      pageType={page.page_type}
                      layoutId={page.layout_id}
                      compact
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {page.title}
                          {page.is_home ? (
                            <span className="ml-1.5 text-xs font-normal text-slate-400">
                              ({t("homeBadge")})
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t(`types.${page.page_type}`)}
                          {layout ? (
                            <>
                              {" · "}
                              {t(`layouts.${layout.labelKey}` as "layouts.homeVitrine")}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          page.is_published
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {page.is_published ? t("status.published") : t("status.draft")}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <label className="inline-flex items-center gap-1.5 text-slate-600">
                        <input
                          type="checkbox"
                          checked={page.is_published}
                          disabled={pending}
                          onChange={(e) => handleTogglePublished(page, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        {t("toggles.published")}
                      </label>
                      {!page.is_home ? (
                        <label className="inline-flex items-center gap-1.5 text-slate-600">
                          <input
                            type="checkbox"
                            checked={page.show_in_nav}
                            disabled={pending || !page.is_published}
                            onChange={(e) => handleToggleNav(page, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          {t("toggles.showInNav")}
                        </label>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <Link
                        href={`/institut/marketing/page-web/${page.id}/builder`}
                        className="font-medium text-slate-700 hover:text-slate-900"
                      >
                        {t("editBuilder")}
                      </Link>
                      <span className="text-slate-300">·</span>
                      <a
                        href={`/institut/marketing/page-web/${page.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-slate-800"
                      >
                        {t("previewFull")}
                      </a>
                      {page.is_published ? (
                        <>
                          <span className="text-slate-300">·</span>
                          <a
                            href={pagePublicUrl(publicBaseUrl, page)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-slate-800"
                          >
                            {t("viewLive")}
                          </a>
                        </>
                      ) : null}
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-800"
                        onClick={() =>
                          setLayoutPickerPageId((id) => (id === page.id ? null : page.id))
                        }
                      >
                        {layoutOpen ? t("hideLayouts") : t("changeLayout")}
                      </button>
                      {!page.is_home ? (
                        <>
                          <span className="text-slate-300">·</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(page)}
                            disabled={pending}
                            className="text-red-600 hover:text-red-700"
                          >
                            {tCommon("delete")}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {layoutOpen ? (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-3">
                    {layoutsForPageType(page.page_type).map((l) => (
                      <SiteLayoutPickerCard
                        key={l.id}
                        pageType={page.page_type}
                        layoutId={l.id}
                        selected={page.layout_id === l.id}
                        disabled={pending}
                        compact
                        onSelect={() => handleApplyLayout(page, l.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-slate-400">{t("footer", { count: pages.length })}</p>
    </div>
  );
}
