"use client";

import { useTranslations } from "next-intl";
import {
  InspectorColor,
  InspectorRow,
  InspectorSection,
  InspectorSegments,
  InspectorSlider,
} from "@/components/site/builder/builder-inspector-primitives";
import type { SitePageMaxWidth, SitePageStyle } from "@/lib/institut/site-page-style";

type BuilderT = ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;

const MAX_WIDTH_OPTIONS: { value: SitePageMaxWidth; labelKey: string }[] = [
  { value: "full", labelKey: "maxWidthFull" },
  { value: "6xl", labelKey: "maxWidth6xl" },
  { value: "5xl", labelKey: "maxWidth5xl" },
  { value: "4xl", labelKey: "maxWidth4xl" },
];

export function SitePageStyleFields({
  style,
  onChange,
  t,
}: {
  style: SitePageStyle;
  onChange: (patch: Partial<SitePageStyle>) => void;
  t: BuilderT;
}) {
  return (
    <div className="-mx-0">
      <InspectorSection title={t("styleSectionBackground")}>
        <InspectorRow label={t("backgroundColor")} htmlFor="page_bg">
          <InspectorColor
            id="page_bg"
            value={style.backgroundColor}
            clearLabel={t("backgroundClear")}
            onChange={(value) => onChange({ backgroundColor: value })}
            onClear={() => onChange({ backgroundColor: null })}
          />
        </InspectorRow>
      </InspectorSection>

      <InspectorSection title={t("styleSectionSpacing")}>
        <InspectorRow label={t("marginXShort")} htmlFor="page_margin_x">
          <InspectorSlider
            id="page_margin_x"
            value={style.marginX}
            min={0}
            max={120}
            onChange={(marginX) => onChange({ marginX })}
          />
        </InspectorRow>
        <InspectorRow label={t("paddingXShort")} htmlFor="page_padding_x">
          <InspectorSlider
            id="page_padding_x"
            value={style.paddingX}
            min={0}
            max={120}
            onChange={(paddingX) => onChange({ paddingX })}
          />
        </InspectorRow>
        <InspectorRow label={t("paddingYShort")} htmlFor="page_padding_y">
          <InspectorSlider
            id="page_padding_y"
            value={style.paddingY}
            min={0}
            max={120}
            onChange={(paddingY) => onChange({ paddingY })}
          />
        </InspectorRow>
      </InspectorSection>

      <InspectorSection title={t("styleSectionLayout")}>
        <InspectorRow label={t("maxWidth")}>
          <InspectorSegments
            value={style.maxWidth}
            options={MAX_WIDTH_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.labelKey as "maxWidthFull"),
            }))}
            onChange={(maxWidth) => onChange({ maxWidth })}
          />
        </InspectorRow>
        <InspectorRow label={t("borderRadiusShort")} htmlFor="page_radius">
          <InspectorSlider
            id="page_radius"
            value={style.borderRadius}
            min={0}
            max={64}
            onChange={(borderRadius) => onChange({ borderRadius })}
          />
        </InspectorRow>
      </InspectorSection>
    </div>
  );
}
