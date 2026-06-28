"use client";

import { useTranslations } from "next-intl";
import {
  getLayoutDef,
  type SitePageLayoutId,
} from "@/lib/institut/site-page-layouts";
import type { SitePageType } from "@/lib/institut/site-pages";

const BLOCK_COLORS: Record<string, string> = {
  hero: "bg-slate-300",
  about: "bg-slate-200",
  services: "bg-slate-200",
  gallery: "bg-slate-200",
  hours: "bg-slate-100",
  contact: "bg-slate-100",
  cta: "bg-slate-400",
};

/** Mini-vignette wireframe d'un modèle de page (~image de preview). */
export function SitePageThumbnail({
  pageType,
  layoutId,
  className = "",
  compact = false,
}: {
  pageType: SitePageType;
  layoutId: SitePageLayoutId;
  className?: string;
  compact?: boolean;
}) {
  const layout = getLayoutDef(pageType, layoutId);
  const blocks = layout?.thumbnailBlocks ?? ["hero"];
  const isModern = layout?.style === "modern";

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-slate-200 bg-white ${
        compact ? "aspect-[5/3] w-full" : "aspect-[16/10] rounded-lg"
      } ${className}`}
      aria-hidden
    >
      <div className="flex h-[14%] items-center gap-1 border-b border-slate-100 px-1.5">
        <div className="h-1 w-4 rounded bg-slate-300" />
        <div className="ml-auto flex gap-0.5">
          <div className="h-0.5 w-2 rounded bg-slate-200" />
          <div className="h-0.5 w-2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="flex h-[86%] flex-col gap-0.5 p-1">
        {blocks.map((block, i) => {
          if (block === "hero") {
            return (
              <div
                key={i}
                className={`flex flex-1 flex-col justify-end rounded-sm px-1 pb-1 ${
                  isModern ? "bg-slate-700" : "bg-slate-100"
                }`}
              >
                <div className={`mb-0.5 h-1 w-3/4 rounded ${isModern ? "bg-slate-500" : "bg-slate-300"}`} />
                <div className={`h-0.5 w-1/2 rounded ${isModern ? "bg-slate-600" : "bg-slate-200"}`} />
              </div>
            );
          }
          const h =
            block === "services" ? "h-[28%]" : block === "cta" ? "h-[12%]" : "h-[14%]";
          return (
            <div
              key={i}
              className={`rounded-sm ${h} ${BLOCK_COLORS[block] ?? "bg-slate-100"} ${
                block === "services" ? "grid grid-cols-3 gap-0.5 p-0.5" : ""
              }`}
            >
              {block === "services"
                ? [0, 1, 2].map((j) => (
                    <div key={j} className="rounded-sm bg-white/60" />
                  ))
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Carte sélectionnable de modèle avec vignette + libellé. */
export function SiteLayoutPickerCard({
  pageType,
  layoutId,
  selected,
  onSelect,
  disabled,
  compact = false,
}: {
  pageType: SitePageType;
  layoutId: SitePageLayoutId;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("institut.marketing.website");
  const tLayouts = useTranslations("institut.marketing.website");
  const layout = getLayoutDef(pageType, layoutId);
  if (!layout) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`w-full rounded-lg border p-2 text-left transition-colors disabled:opacity-50 ${
        compact ? "max-w-[140px]" : ""
      } ${
        selected
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <SitePageThumbnail pageType={pageType} layoutId={layoutId} compact={compact} />
      {!compact ? (
        <>
          <p className="mt-2 text-xs font-medium text-slate-900">
            {tLayouts(`layouts.${layout.labelKey}` as "layouts.homeVitrine")}
          </p>
          <p className="text-[10px] leading-tight text-slate-500">
            {tLayouts(`layouts.${layout.descriptionKey}` as "layouts.homeVitrineDesc")}
          </p>
        </>
      ) : (
        <p className="mt-1 truncate text-[10px] font-medium text-slate-800">
          {tLayouts(`layouts.${layout.labelKey}` as "layouts.homeVitrine")}
        </p>
      )}
    </button>
  );
}
