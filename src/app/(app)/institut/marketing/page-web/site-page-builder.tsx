"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  applyPageLayout,
  saveSitePageBuilder,
  type ActionResult,
} from "./site-actions";
import { createSiteBlock } from "./site-builder-utils";
import type { PublicService } from "@/lib/public/booking-load";
import { layoutVisualStyle } from "@/lib/institut/site-page-layouts";
import { SiteBuilderCanvas } from "@/components/site/builder/site-builder-canvas";
import {
  SiteBuilderSidebar,
  type BuilderSidebarTab,
} from "@/components/site/builder/site-builder-sidebar";
import type { FormattedOpeningDay } from "@/components/site/site-page-renderer";
import { Button } from "@/components/ui/button";
import type { SiteBlock, SiteBlockType, SitePageRow } from "@/lib/institut/site-pages";

const initial: ActionResult = {};

export function SitePageBuilder({
  page,
  previewServices,
  scheduleDays = [],
  accentColor = "#0f172a",
}: {
  page: SitePageRow;
  previewServices: PublicService[];
  scheduleDays?: FormattedOpeningDay[];
  accentColor?: string;
}) {
  const t = useTranslations("institut.marketing.website.builder");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveSitePageBuilder, initial);
  const [layoutPending, startLayoutTransition] = useTransition();
  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState<SiteBlock[]>(page.content);
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "");
  const [published, setPublished] = useState(page.is_published);
  const [selectedId, setSelectedId] = useState<string | null>(page.content[0]?.id ?? null);
  const [sidebarTab, setSidebarTab] = useState<BuilderSidebarTab>("block");

  const blocksJson = useMemo(() => JSON.stringify(blocks), [blocks]);
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const previewTemplateId = layoutVisualStyle(page.layout_id);

  function updateBlock(id: string, patch: Partial<SiteBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...patch } as SiteBlock) : b)),
    );
  }

  function removeBlock(id: string) {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function addBlock(type: SiteBlockType) {
    const block = createSiteBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setSidebarTab("block");
  }

  function handleSelectBlock(id: string | null) {
    setSelectedId(id);
    if (id) setSidebarTab("block");
  }

  function handleApplyLayout(layoutId: string) {
    if (layoutId === page.layout_id) return;
    if (!confirm(t("layoutChangeConfirm"))) return;
    startLayoutTransition(async () => {
      const res = await applyPageLayout(page.id, layoutId, true);
      if (res.error) alert(res.error);
      else window.location.reload();
    });
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link
          href="/institut/marketing/page-web"
          className="shrink-0 text-sm text-slate-500 hover:text-slate-800"
        >
          ← {t("back")}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{t("modeLabel")}</p>
        </div>
        <a
          href={`/institut/marketing/page-web/${page.id}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 text-sm text-slate-600 hover:text-slate-900 sm:inline"
        >
          {t("previewFull")}
        </a>
        <form action={action} className="flex shrink-0 items-center gap-2">
          <input type="hidden" name="id" value={page.id} />
          <input type="hidden" name="blocks_json" value={blocksJson} />
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="seo_title" value={seoTitle} />
          <input type="hidden" name="seo_description" value={seoDescription} />
          {published ? <input type="hidden" name="is_published" value="1" /> : null}
          <Button type="submit" className="h-9 px-4" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </header>

      {state.error ? (
        <p className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="shrink-0 border-b border-green-100 bg-green-50 px-4 py-2 text-sm text-green-700">
          {state.message ?? t("saved")}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <SiteBuilderSidebar
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          blocks={blocks}
          selectedId={selectedId}
          selectedBlock={selectedBlock}
          pageType={page.page_type}
          layoutId={page.layout_id}
          title={title}
          seoTitle={seoTitle}
          seoDescription={seoDescription}
          published={published}
          pending={pending}
          layoutPending={layoutPending}
          onSelectBlock={(id) => handleSelectBlock(id)}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onRemoveBlock={removeBlock}
          onTitleChange={setTitle}
          onSeoTitleChange={setSeoTitle}
          onSeoDescriptionChange={setSeoDescription}
          onPublishedChange={setPublished}
          onApplyLayout={handleApplyLayout}
        />

        <SiteBuilderCanvas
          blocks={blocks}
          selectedId={selectedId}
          templateId={previewTemplateId}
          services={previewServices}
          scheduleDays={scheduleDays}
          accent={accentColor}
          onSelect={handleSelectBlock}
          onReorder={setBlocks}
        />
      </div>
    </div>
  );
}
