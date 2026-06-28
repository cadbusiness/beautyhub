"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SiteLayoutPickerCard } from "@/components/site/site-page-thumbnail";
import { SiteBuilderBlockFields } from "@/components/site/builder/site-builder-fields";
import { SiteBuilderWidgetPanel } from "@/components/site/builder/site-builder-widget-panel";
import { SitePageStyleFields } from "@/components/site/builder/site-page-style-fields";
import {
  InspectorCheckbox,
  InspectorRow,
  InspectorSection,
  InspectorTextInput,
  InspectorTextarea,
} from "@/components/site/builder/builder-inspector-primitives";
import type { SitePageStyle } from "@/lib/institut/site-page-style";
import { BLOCK_WIDGET_ICONS } from "@/lib/institut/site-widget-catalog";
import type { SiteBlock, SiteBlockType, SitePageType } from "@/lib/institut/site-pages";
import { layoutsForPageType } from "@/lib/institut/site-page-layouts";
import { cn } from "@/lib/utils";

export type BuilderSidebarTab = "block" | "page";
export type BlockSidebarTab = "add" | "content";
export type PageSidebarTab = "style" | "layout" | "settings";

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
  const [pageSubTab, setPageSubTab] = useState<PageSidebarTab>("style");
  const [blockSubTab, setBlockSubTab] = useState<BlockSidebarTab>("add");

  useEffect(() => {
    if (selectedId) setBlockSubTab("content");
  }, [selectedId]);

  function handleAddBlock(type: SiteBlockType) {
    onAddBlock(type);
    setBlockSubTab("content");
  }

  function handleStructureSelect(id: string) {
    onSelectBlock(id);
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-[#fafafa]">
      <div className="flex shrink-0 border-b border-slate-200 bg-white">
        <SidebarTab active={tab === "block"} onClick={() => onTabChange("block")} label={t("inspectorBlock")} />
        <SidebarTab active={tab === "page"} onClick={() => onTabChange("page")} label={t("inspectorPage")} />
      </div>

      {tab === "block" ? (
        <div className="flex shrink-0 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
          <PageSubTab active={blockSubTab === "add"} onClick={() => setBlockSubTab("add")} label={t("blockSubAdd")} />
          <PageSubTab
            active={blockSubTab === "content"}
            onClick={() => setBlockSubTab("content")}
            label={t("blockSubContent")}
          />
        </div>
      ) : null}

      {tab === "page" ? (
        <div className="flex shrink-0 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
          <PageSubTab active={pageSubTab === "style"} onClick={() => setPageSubTab("style")} label={t("pageSubStyle")} />
          <PageSubTab active={pageSubTab === "layout"} onClick={() => setPageSubTab("layout")} label={t("pageSubLayout")} />
          <PageSubTab active={pageSubTab === "settings"} onClick={() => setPageSubTab("settings")} label={t("pageSubSettings")} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "block" ? (
          blockSubTab === "add" ? (
            <div className="bg-white px-2 py-2">
              <p className="mb-1 px-1 text-[10px] text-slate-500">{t("widgetsHint")}</p>
              <SiteBuilderWidgetPanel onAdd={handleAddBlock} t={t} />
            </div>
          ) : (
            <div className="bg-white">
              {blocks.length > 0 ? (
                <section className="border-b border-slate-100 px-2 py-2">
                  <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t("structure")}
                  </p>
                  <ul className="space-y-0.5">
                    {blocks.map((block, index) => (
                      <li key={block.id}>
                        <button
                          type="button"
                          onClick={() => handleStructureSelect(block.id)}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition",
                            selectedId === block.id
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <span className="w-3 shrink-0 text-[9px] tabular-nums opacity-50">{index + 1}</span>
                          <span className="w-4 shrink-0 text-center text-[10px] opacity-70">
                            {BLOCK_WIDGET_ICONS[block.type]}
                          </span>
                          <span className="truncate">{t(`blockTypes.${block.type}`)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">{t("structureEmpty")}</p>
              )}

              <section className="p-3">
                {selectedBlock ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-semibold text-slate-900">
                        {t(`blockTypes.${selectedBlock.type}`)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onRemoveBlock(selectedBlock.id)}
                        className="text-[10px] text-red-600 hover:text-red-700"
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                    <SiteBuilderBlockFields
                      block={selectedBlock}
                      onChange={(patch) => onUpdateBlock(selectedBlock.id, patch)}
                      t={t}
                    />
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-500">{t("selectBlockHint")}</p>
                )}
              </section>
            </div>
          )
        ) : pageSubTab === "style" ? (
          <div className="bg-white py-1">
            <SitePageStyleFields style={pageStyle} onChange={onPageStyleChange} t={t} />
          </div>
        ) : pageSubTab === "layout" ? (
          <div className="bg-white py-1">
            <InspectorSection title={t("pageLayout")} defaultOpen>
              <p className="mb-2 text-[10px] leading-snug text-slate-500">{t("pageLayoutHint")}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {layoutsForPageType(pageType).map((layout) => (
                  <SiteLayoutPickerCard
                    key={layout.id}
                    pageType={pageType}
                    layoutId={layout.id}
                    selected={layoutId === layout.id}
                    disabled={pending || layoutPending}
                    compact
                    onSelect={() => onApplyLayout(layout.id)}
                  />
                ))}
              </div>
            </InspectorSection>
          </div>
        ) : (
          <div className="bg-white py-1">
            <InspectorSection title={t("pageSubSettings")} defaultOpen>
              <div className="space-y-2">
                <InspectorRow label={t("pageTitle")} htmlFor="builder_title">
                  <InspectorTextInput id="builder_title" value={title} onChange={onTitleChange} />
                </InspectorRow>
                <InspectorRow label={t("seoTitle")} htmlFor="builder_seo_title">
                  <InspectorTextInput id="builder_seo_title" value={seoTitle} onChange={onSeoTitleChange} />
                </InspectorRow>
                <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
                  <label htmlFor="builder_seo_description" className="pt-1 text-[11px] text-slate-600">
                    {t("seoDescription")}
                  </label>
                  <InspectorTextarea
                    id="builder_seo_description"
                    value={seoDescription}
                    onChange={onSeoDescriptionChange}
                  />
                </div>
                <InspectorCheckbox
                  id="builder_published"
                  label={t("published")}
                  checked={published}
                  onChange={onPublishedChange}
                />
              </div>
            </InspectorSection>
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
        "flex-1 px-2 py-2.5 text-xs font-medium transition",
        active ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {label}
    </button>
  );
}

function PageSubTab({
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
        "flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {label}
    </button>
  );
}
