"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteTheme, uploadSiteLogo, type ActionResult } from "../site-actions";
import { SitePageRenderer } from "@/components/site/site-page-renderer";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { SiteSettingsRow } from "@/lib/institut/site-settings";

const initial: ActionResult = {};

const SAMPLE_BLOCKS = [
  {
    id: "sample-hero",
    type: "hero" as const,
    headline: "Votre institut",
    subheadline: "Soins et bien-être sur mesure",
    ctaLabel: "Réserver",
    ctaHref: "/reserver",
  },
];

export function SiteThemeForm({
  settings,
  instituteName,
}: {
  settings: SiteSettingsRow;
  instituteName: string;
}) {
  const t = useTranslations("institut.marketing.website.theme");
  const tCommon = useTranslations("common");
  const tBlocks = useTranslations("public.site.blocks");
  const blockLabels = {
    noImages: tBlocks("noImages"),
    hoursByAppointment: tBlocks("hoursByAppointment"),
  };
  const [state, action, pending] = useActionState(saveSiteTheme, initial);
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color);
  const [displayName, setDisplayName] = useState(settings.display_name ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? "");
  const [footerText, setFooterText] = useState(settings.footer_text ?? "");
  const [uploading, startUpload] = useTransition();

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const res = await uploadSiteLogo(fd);
      if (res.error) alert(res.error);
      else if (res.url) setLogoUrl(res.url);
    });
    e.target.value = "";
  }

  const previewName = displayName.trim() || instituteName;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <form action={action} className="w-full shrink-0 space-y-5 lg:w-80 xl:w-96">
        <input type="hidden" name="primary_color" value={primaryColor} />
        <input type="hidden" name="display_name" value={displayName} />
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input type="hidden" name="footer_text" value={footerText} />

        <p className="text-sm text-slate-600">{t("description")}</p>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-green-600">{state.message ?? t("saved")}</p> : null}

        <Field label={t("displayName")} htmlFor="display_name">
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={instituteName}
          />
        </Field>

        <Field label={t("primaryColor")} htmlFor="primary_color">
          <div className="flex gap-2">
            <input
              id="primary_color_picker"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-slate-200"
            />
            <Input
              id="primary_color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="font-mono"
            />
          </div>
        </Field>

        <Field label={t("logo")}>
          <div className="space-y-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-12 w-auto max-w-[160px] object-contain" />
            ) : null}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
              {uploading ? t("uploading") : logoUrl ? t("replaceLogo") : t("uploadLogo")}
            </label>
            {logoUrl ? (
              <button type="button" className="text-xs text-red-600" onClick={() => setLogoUrl("")}>
                {t("removeLogo")}
              </button>
            ) : null}
          </div>
        </Field>

        <Field label={t("footerText")} htmlFor="footer_text">
          <Textarea
            id="footer_text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={2}
          />
        </Field>

        <Button type="submit" className="h-9 w-full" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
      </form>

      <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          {t("previewLabel")}
        </div>
        <div className="overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
                ) : null}
                <p className="truncate text-lg font-semibold" style={{ color: primaryColor }}>
                  {previewName}
                </p>
              </div>
              <nav className="flex shrink-0 gap-3 text-xs text-slate-600">
                <span>{t("navSample.home")}</span>
                <span>{t("navSample.book")}</span>
              </nav>
            </div>
          </header>
          <SitePageRenderer
            blocks={SAMPLE_BLOCKS}
            templateId="elegant"
            services={[]}
            accent={primaryColor}
            blockLabels={blockLabels}
          />
          {footerText ? (
            <p className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500">
              {footerText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
