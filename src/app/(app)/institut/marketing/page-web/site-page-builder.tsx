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
import {
  layoutVisualStyle,
  layoutsForPageType,
} from "@/lib/institut/site-page-layouts";
import { SiteLayoutPickerCard } from "@/components/site/site-page-thumbnail";
import { SiteBuilderCanvas } from "@/components/site/builder/site-builder-canvas";
import { SiteBuilderBlockFields } from "@/components/site/builder/site-builder-fields";
import type { FormattedOpeningDay } from "@/components/site/site-page-renderer";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  SITE_BLOCK_TYPES,
  type SiteBlock,
  type SiteBlockType,
  type SitePageRow,
} from "@/lib/institut/site-pages";
import { cn } from "@/lib/utils";

const initial: ActionResult = {};

type InspectorTab = "block" | "page";

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
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("block");

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
    setInspectorTab("block");
  }

  function handleSelectBlock(id: string | null) {
    setSelectedId(id);
    if (id) setInspectorTab("block");
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
    <div className="flex h-dvh flex-col bg-white">
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
        <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("widgets")}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{t("widgetsHint")}</p>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {SITE_BLOCK_TYPES.map(({ type }) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                  {t(`blockTypes.${type}`).slice(0, 1)}
                </span>
                {t(`blockTypes.${type}`)}
              </button>
            ))}
          </div>
        </aside>

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

        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setInspectorTab("block")}
              className={cn(
                "flex-1 px-3 py-2.5 text-sm font-medium transition",
                inspectorTab === "block"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t("inspectorBlock")}
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab("page")}
              className={cn(
                "flex-1 px-3 py-2.5 text-sm font-medium transition",
                inspectorTab === "page"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t("inspectorPage")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {inspectorTab === "block" ? (
              selectedBlock ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t(`blockTypes.${selectedBlock.type}`)}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeBlock(selectedBlock.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      {tCommon("delete")}
                    </button>
                  </div>
                  <SiteBuilderBlockFields
                    block={selectedBlock}
                    onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                    t={t}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("selectBlockHint")}</p>
              )
            ) : (
              <div className="space-y-6">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">{t("pageLayout")}</h3>
                  <p className="text-xs text-slate-500">{t("pageLayoutHint")}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {layoutsForPageType(page.page_type).map((layout) => (
                      <SiteLayoutPickerCard
                        key={layout.id}
                        pageType={page.page_type}
                        layoutId={layout.id}
                        selected={page.layout_id === layout.id}
                        disabled={pending || layoutPending}
                        onSelect={() => handleApplyLayout(layout.id)}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <Field label={t("pageTitle")} htmlFor="builder_title">
                    <Input
                      id="builder_title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t("seoTitle")} htmlFor="builder_seo_title">
                    <Input
                      id="builder_seo_title"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                    />
                  </Field>
                  <Field label={t("seoDescription")} htmlFor="builder_seo_description">
                    <Textarea
                      id="builder_seo_description"
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      rows={2}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                    />
                    {t("published")}
                  </label>
                </section>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
