"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { uploadSiteGalleryImage } from "@/app/(app)/institut/marketing/page-web/site-actions";
import { Input, Select, Textarea } from "@/components/ui/input";
import type {
  SiteBlock,
  SiteGalleryBlock,
  SiteGalleryImage,
} from "@/lib/institut/site-pages";

type BuilderT = ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;

export function SiteBuilderBlockFields({
  block,
  onChange,
  t,
}: {
  block: SiteBlock;
  onChange: (patch: Partial<SiteBlock>) => void;
  t: BuilderT;
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Input
            value={block.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder={t("fields.headline")}
          />
          <Input
            value={block.subheadline}
            onChange={(e) => onChange({ subheadline: e.target.value })}
            placeholder={t("fields.subheadline")}
          />
          <Input
            value={block.ctaLabel}
            onChange={(e) => onChange({ ctaLabel: e.target.value })}
            placeholder={t("fields.ctaLabel")}
          />
          <Input
            value={block.ctaHref}
            onChange={(e) => onChange({ ctaHref: e.target.value })}
            placeholder={t("fields.ctaHref")}
          />
          <Input
            value={block.imageUrl ?? ""}
            onChange={(e) => onChange({ imageUrl: e.target.value || undefined })}
            placeholder={t("fields.imageUrl")}
          />
        </div>
      );
    case "about":
      return (
        <div className="space-y-3">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} rows={4} />
        </div>
      );
    case "services":
      return (
        <div className="space-y-3">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showPrices}
              onChange={(e) => onChange({ showPrices: e.target.checked })}
            />
            {t("fields.showPrices")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showImages ?? true}
              onChange={(e) => onChange({ showImages: e.target.checked })}
            />
            {t("fields.showImages")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.showSearch ?? false}
              onChange={(e) => onChange({ showSearch: e.target.checked })}
            />
            {t("fields.showSearch")}
          </label>
          <Input
            type="number"
            min={1}
            max={24}
            value={block.limit}
            onChange={(e) => onChange({ limit: Number(e.target.value) })}
          />
        </div>
      );
    case "gallery":
      return <GalleryBlockFields block={block} onChange={onChange} t={t} />;
    case "contact":
      return (
        <div className="space-y-3">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Input
            value={block.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={t("fields.phone")}
          />
          <Input
            value={block.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder={t("fields.email")}
          />
          <Textarea
            value={block.address}
            onChange={(e) => onChange({ address: e.target.value })}
            rows={2}
            placeholder={t("fields.address")}
          />
          <Textarea
            value={block.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={2}
            placeholder={t("fields.note")}
          />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} rows={2} />
          <Input
            value={block.buttonLabel}
            onChange={(e) => onChange({ buttonLabel: e.target.value })}
          />
          <Input
            value={block.buttonHref}
            onChange={(e) => onChange({ buttonHref: e.target.value })}
          />
        </div>
      );
    case "hours":
      return (
        <div className="space-y-3">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.useSchedule ?? false}
              onChange={(e) => onChange({ useSchedule: e.target.checked })}
            />
            {t("fields.useSchedule")}
          </label>
          <Textarea
            value={block.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={2}
            placeholder={t("fields.hoursNote")}
          />
        </div>
      );
    default:
      return null;
  }
}

function GalleryBlockFields({
  block,
  onChange,
  t,
}: {
  block: SiteGalleryBlock;
  onChange: (patch: Partial<SiteGalleryBlock>) => void;
  t: BuilderT;
}) {
  const [uploading, startUpload] = useTransition();

  function updateImage(id: string, patch: Partial<SiteGalleryImage>) {
    onChange({
      images: block.images.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    });
  }

  function removeImage(id: string) {
    onChange({ images: block.images.filter((img) => img.id !== id) });
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const res = await uploadSiteGalleryImage(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (res.url) {
        onChange({
          images: [...block.images, { id: crypto.randomUUID(), url: res.url }],
        });
      }
    });
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
      <Select
        value={String(block.columns)}
        onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 | 4 })}
      >
        <option value="2">{t("fields.galleryCols2")}</option>
        <option value="3">{t("fields.galleryCols3")}</option>
        <option value="4">{t("fields.galleryCols4")}</option>
      </Select>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input type="file" accept="image/*" className="text-xs" onChange={handleUpload} disabled={uploading} />
        {uploading ? t("fields.uploading") : t("fields.addImage")}
      </label>
      <ul className="space-y-2">
        {block.images.map((img) => (
          <li key={img.id} className="flex gap-2 rounded border border-slate-100 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                value={img.caption ?? ""}
                onChange={(e) => updateImage(img.id, { caption: e.target.value })}
                placeholder={t("fields.caption")}
                className="h-8 text-xs"
              />
              <button type="button" className="text-xs text-red-600" onClick={() => removeImage(img.id)}>
                {t("fields.removeImage")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
