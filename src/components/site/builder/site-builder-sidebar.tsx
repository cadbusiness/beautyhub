"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SiteLayoutPickerCard } from "@/components/site/site-page-thumbnail";
import { SiteBuilderBlockFields } from "@/components/site/builder/site-builder-fields";
import { SitePageStyleFields } from "@/components/site/builder/site-page-style-fields";
import {
  InspectorCheckbox,
  InspectorRow,
  InspectorSection,
  InspectorTextInput,
  InspectorTextarea,
} from "@/components/site/builder/builder-inspector-primitives";
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
export type BlockSidebarTab = "edit" | "structure" | "add";
export type PageSidebarTab = "style" | "layout" | "settings";

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
  const [pageSubTab, setPageSubTab] = useState<PageSidebarTab>("style");
  const [blockSubTab, setBlockSubTab] = useState<BlockSidebarTab>(
    selectedId ? "edit" : blocks.length > 0 ? "structure" : "add",
  );

  useEffect(() => {
    if (selectedId) setBlockSubTab("edit");
  }, [selectedId]);

  function handleBlockTabClick() {
    onTabChange("block");
  }

  function handlePageTabClick() {
    onTabChange("page");
  }

  function handleStructureSelect(id: string) {
    onSelectBlock(id);
    setBlockSubTab("edit");
  }

  function handleAddBlock(type: SiteBlockType) {
    onAddBlock(type);
    setBlockSubTab("edit");
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-[#fafafa]">
      <div className="flex shrink-0 border-b border-slate-200">
        <SidebarTab active={tab === "block"} onClick={handleBlockTabClick} label={t("inspectorBlock")} />
        <SidebarTab active={tab === "page"} onClick={handlePageTabClick} label={t("inspectorPage")} />
      </div>

      {tab === "block" ? (
        <div className="flex shrink-0 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
          <PageSubTab active={blockSubTab === "edit"} onClick={() => setBlockSubTab("edit")} label={t("blockSubEdit")} />
          <PageSubTab active={blockSubTab === "structure"} onClick={() => setBlockSubTab("structure")} label={t("blockSubStructure")} />
          <PageSubTab active={blockSubTab === "add"} onClick={() => setBlockSubTab("add")} label={t("blockSubAdd")} />
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
          blockSubTab === "edit" ? (
            <div className="bg-white p-3">
              {selectedBlock ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        {t("blockSubEdit")}
                      </p>
                      <h3 className="text-xs font-semibold text-slate-900">
                        {t(`blockTypes.${selectedBlock.type}`)}
                      </h3>
                    </div>
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
            </div>
          ) : blockSubTab === "structure" ? (
            <div className="bg-white p-3">
              {blocks.length > 0 ? (
                <>
                  <p className="mb-2 text-[10px] leading-snug text-slate-500">{t("structureHint")}</p>
                  <ul className="space-y-0.5">
                    {blocks.map((block, index) => (
                      <li key={block.id}>
                        <button
                          type="button"
                          onClick={() => handleStructureSelect(block.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition",
                            selectedId === block.id
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <span className="w-4 shrink-0 text-center text-[10px] tabular-nums opacity-60">
                            {index + 1}
                          </span>
                          <span className="w-4 shrink-0 text-center text-xs opacity-70">
                            {BLOCK_ICONS[block.type]}
                          </span>
                          <span className="truncate">{t(`blockTypes.${block.type}`)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">{t("structureEmpty")}</p>
              )}
            </div>
          ) : (
            <div className="bg-white p-3">
              <p className="mb-2 text-[10px] leading-snug text-slate-500">{t("widgetsHint")}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SITE_BLOCK_TYPES.map(({ type }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAddBlock(type)}
                    className="flex flex-col items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-2 text-center text-[10px] text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    <span className="text-sm text-slate-500">{BLOCK_ICONS[type]}</span>
                    <span className="leading-tight">{t(`blockTypes.${type}`)}</span>
                  </button>
                ))}
              </div>
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
                  <InspectorTextInput
                    id="builder_title"
                    value={title}
                    onChange={onTitleChange}
                  />
                </InspectorRow>
                <InspectorRow label={t("seoTitle")} htmlFor="builder_seo_title">
                  <InspectorTextInput
                    id="builder_seo_title"
                    value={seoTitle}
                    onChange={onSeoTitleChange}
                  />
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
        active
          ? "border-b-2 border-slate-900 text-slate-900"
          : "text-slate-500 hover:text-slate-700",
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
        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {label}
    </button>
  );
}
