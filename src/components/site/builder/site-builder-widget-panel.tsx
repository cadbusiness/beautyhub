"use client";

import { useTranslations } from "next-intl";
import {
  BLOCK_WIDGET_HINTS,
  BLOCK_WIDGET_ICONS,
  SITE_WIDGET_CATEGORIES,
} from "@/lib/institut/site-widget-catalog";
import type { SiteBlockType } from "@/lib/institut/site-pages";

type BuilderT = ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;

export function SiteBuilderWidgetPanel({
  onAdd,
  t,
}: {
  onAdd: (type: SiteBlockType) => void;
  t: BuilderT;
}) {
  return (
    <div className="divide-y divide-slate-100">
      {SITE_WIDGET_CATEGORIES.map((category) => (
        <section key={category.id} className="py-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t(category.labelKey as "widgetCatLayout")}
          </p>
          <ul>
            {category.types.map((type) => {
              const hintKey = BLOCK_WIDGET_HINTS[type];
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onAdd(type)}
                    className="flex w-full items-start gap-2 rounded px-1 py-1.5 text-left transition hover:bg-slate-50"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-500">
                      {BLOCK_WIDGET_ICONS[type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-slate-800">
                        {t(`blockTypes.${type}`)}
                      </span>
                      {hintKey ? (
                        <span className="block text-[10px] leading-snug text-slate-400">
                          {t(hintKey as "widgetHintText")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
