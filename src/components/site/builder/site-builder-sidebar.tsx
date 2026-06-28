"use client";

import { useTranslations } from "next-intl";
import { SiteLayoutPickerCard } from "@/components/site/site-page-thumbnail";
import { SiteBuilderBlockFields } from "@/components/site/builder/site-builder-fields";
import { SitePageStyleFields } from "@/components/site/builder/site-page-style-fields";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { SitePageStyle } from "@/lib/institut/site-page-style";
import {
  SITE_BLOCK_TYPES,
  type SiteBlock,
  type SiteBlockType,
  type SitePageType,
} from "@/lib/institut/site-pages";
import {
  layoutsForPageType,
} from "@/lib/institut/site-page-layouts";
import { cn } from "@/lib/utils";

export type BuilderSidebarTab = "block" | "page";

const BLOCK_ICONS: Record<SiteBlockType, string> = {
  hero: "▣",
  about: "¶",
  services: "☰",
  gallery: "▦",
  hours: "◷",
  contact: "✉",
  cta: "→",
};

export function SiteBuilderSidebar({
  tab,
  onTabChange,
  blocks,
  selectedId,
  selectedBlock,
  pageType,
  layoutId,
  title,
  seoTitle,
  seoDescription,
  published,
  pageStyle,
  pending,
  layoutPending,
  onSelectBlock,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onTitleChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onPublishedChange,
  onPageStyleChange,
  onApplyLayout,
}: {
  tab: BuilderSidebarTab;
  onTabChange: (tab: BuilderSidebarTab) => void;
  blocks: SiteBlock[];
  selectedId: string | null;
  selectedBlock: SiteBlock | null;
  pageType: SitePageType;
  layoutId: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  pageStyle: SitePageStyle;
  pending: boolean;
  layoutPending: boolean;
  onSelectBlock: (id: string) => void;
  onAddBlock: (type: SiteBlockType) => void;
  onUpdateBlock: (id: string, patch: Partial<SiteBlock>) => void;
  onRemoveBlock: (id: string) => void;
  onTitleChange: (value: string) => void;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onPublishedChange: (value: boolean) => void;
  onPageStyleChange: (patch: Partial<SitePageStyle>) => void;
  onApplyLayout: (layoutId: string) => void;
}) {
  const t = useTranslations("institut.marketing.website.builder");
  const tCommon = useTranslations("common");

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex shrink-0 border-b border-slate-200">
        <SidebarTab active={tab === "block"} onClick={() => onTabChange("block")} label={t("inspectorBlock")} />
        <SidebarTab active={tab === "page"} onClick={() => onTabChange("page")} label={t("inspectorPage")} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "block" ? (
          <div className="flex flex-col gap-0">
            {selectedBlock ? (
              <section className="border-b border-slate-100 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t(`blockTypes.${selectedBlock.type}`)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onRemoveBlock(selectedBlock.id)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    {tCommon("delete")}
                  </button>
                </div>
                <SiteBuilderBlockFields
                  block={selectedBlock}
                  onChange={(patch) => onUpdateBlock(selectedBlock.id, patch)}
                  t={t}
                />
              </section>
            ) : (
              <section className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm text-slate-500">{t("selectBlockHint")}</p>
              </section>
            )}

            {blocks.length > 0 ? (
              <section className="border-b border-slate-100 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("structure")}
                </p>
                <ul className="space-y-0.5">
                  {blocks.map((block) => (
                    <li key={block.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBlock(block.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                          selectedId === block.id
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        <span className="w-4 shrink-0 text-center text-xs opacity-70">
                          {BLOCK_ICONS[block.type]}
                        </span>
                        <span className="truncate">{t(`blockTypes.${block.type}`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("widgets")}
              </p>
              <p className="mb-3 text-xs text-slate-400">{t("widgetsHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                {SITE_BLOCK_TYPES.map(({ type }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onAddBlock(type)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-center text-xs text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    <span className="text-base text-slate-500">{BLOCK_ICONS[type]}</span>
                    <span className="leading-tight">{t(`blockTypes.${type}`)}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            <SitePageStyleFields
              style={pageStyle}
              onChange={onPageStyleChange}
              t={t}
            />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">{t("pageLayout")}</h3>
              <p className="text-xs text-slate-500">{t("pageLayoutHint")}</p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {layoutsForPageType(pageType).map((layout) => (
                  <SiteLayoutPickerCard
                    key={layout.id}
                    pageType={pageType}
                    layoutId={layout.id}
                    selected={layoutId === layout.id}
                    disabled={pending || layoutPending}
                    onSelect={() => onApplyLayout(layout.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <Field label={t("pageTitle")} htmlFor="builder_title">
                <Input
                  id="builder_title"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  required
                />
              </Field>
              <Field label={t("seoTitle")} htmlFor="builder_seo_title">
                <Input
                  id="builder_seo_title"
                  value={seoTitle}
                  onChange={(e) => onSeoTitleChange(e.target.value)}
                />
              </Field>
              <Field label={t("seoDescription")} htmlFor="builder_seo_description">
                <Textarea
                  id="builder_seo_description"
                  value={seoDescription}
                  onChange={(e) => onSeoDescriptionChange(e.target.value)}
                  rows={2}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => onPublishedChange(e.target.checked)}
                />
                {t("published")}
              </label>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 px-3 py-3 text-sm font-medium transition",
        active
          ? "border-b-2 border-slate-900 text-slate-900"
          : "text-slate-500 hover:text-slate-700",
      )}
    >
      {label}
    </button>
  );
}
