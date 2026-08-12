"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  saveInstitutBranding,
  uploadInstitutLogo,
  type BrandingActionResult,
} from "./branding-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { TenantBrandingSnapshot } from "@/lib/institut/tenant-branding";

const initial: BrandingActionResult = {};

export function InstitutBrandingForm({
  branding,
  instituteName,
}: {
  branding: TenantBrandingSnapshot;
  instituteName: string;
}) {
  const t = useTranslations("account.branding");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveInstitutBranding, initial);
  const [displayName, setDisplayName] = useState(branding.displayName);
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? "");
  const [uploading, startUpload] = useTransition();

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const res = await uploadInstitutLogo(fd);
      if (res.error) alert(res.error);
      else if (res.url) setLogoUrl(res.url);
    });
    e.target.value = "";
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={action} className="space-y-5">
        <input type="hidden" name="display_name" value={displayName} />
        <input type="hidden" name="primary_color" value={primaryColor} />
        <input type="hidden" name="logo_url" value={logoUrl} />

        <p className="text-sm text-slate-600">{t("description")}</p>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? (
          <p className="text-sm text-green-600">{state.message ?? t("saved")}</p>
        ) : null}

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
          <div className="space-y-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-16 max-w-[220px] rounded-lg border border-slate-200 bg-white object-contain p-2"
              />
            ) : (
              <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                {t("noLogo")}
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={uploading}
              />
              <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
                {uploading ? tCommon("loading") : t("uploadLogo")}
              </span>
            </label>
            <p className="text-xs text-slate-500">{t("logoHint")}</p>
          </div>
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
      </form>

      <aside className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("previewTitle")}
        </p>
        <div className="mt-4 rounded-2xl bg-[#F5F5F5] p-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {(displayName || instituteName).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {displayName.trim() || instituteName}
              </p>
              <p className="text-xs text-slate-500">{t("previewSubtitle")}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
