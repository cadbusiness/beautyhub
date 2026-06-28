"use client";

import { useTranslations } from "next-intl";
import { Field, Input, Select } from "@/components/ui/input";
import type { SitePageMaxWidth, SitePageStyle } from "@/lib/institut/site-page-style";

type BuilderT = ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;

export function SitePageStyleFields({
  style,
  onChange,
  t,
}: {
  style: SitePageStyle;
  onChange: (patch: Partial<SitePageStyle>) => void;
  t: BuilderT;
}) {
  const bg = style.backgroundColor ?? "#ffffff";

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{t("pageStyleTitle")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{t("pageStyleHint")}</p>
      </div>

      <Field label={t("backgroundColor")} htmlFor="page_bg">
        <div className="flex items-center gap-2">
          <input
            id="page_bg"
            type="color"
            value={bg}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
            className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
          />
          <Input
            value={style.backgroundColor ?? ""}
            onChange={(e) => onChange({ backgroundColor: e.target.value.trim() || null })}
            placeholder="#ffffff"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onChange({ backgroundColor: null })}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-800"
          >
            {t("backgroundClear")}
          </button>
        </div>
      </Field>

      <Field label={t("marginX")} htmlFor="page_margin_x">
        <Input
          id="page_margin_x"
          type="number"
          min={0}
          max={120}
          value={style.marginX}
          onChange={(e) => onChange({ marginX: Number(e.target.value) })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("paddingX")} htmlFor="page_padding_x">
          <Input
            id="page_padding_x"
            type="number"
            min={0}
            max={120}
            value={style.paddingX}
            onChange={(e) => onChange({ paddingX: Number(e.target.value) })}
          />
        </Field>
        <Field label={t("paddingY")} htmlFor="page_padding_y">
          <Input
            id="page_padding_y"
            type="number"
            min={0}
            max={120}
            value={style.paddingY}
            onChange={(e) => onChange({ paddingY: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label={t("maxWidth")} htmlFor="page_max_width">
        <Select
          id="page_max_width"
          value={style.maxWidth}
          onChange={(e) => onChange({ maxWidth: e.target.value as SitePageMaxWidth })}
        >
          <option value="full">{t("maxWidthFull")}</option>
          <option value="6xl">{t("maxWidth6xl")}</option>
          <option value="5xl">{t("maxWidth5xl")}</option>
          <option value="4xl">{t("maxWidth4xl")}</option>
        </Select>
      </Field>

      <Field label={t("borderRadius")} htmlFor="page_radius">
        <Input
          id="page_radius"
          type="number"
          min={0}
          max={64}
          value={style.borderRadius}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
        />
      </Field>
    </section>
  );
}
