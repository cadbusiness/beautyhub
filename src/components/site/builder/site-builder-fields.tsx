"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { uploadSiteGalleryImage } from "@/app/(app)/institut/marketing/page-web/site-actions";
import {
  InspectorCheckbox,
  InspectorRow,
  InspectorSelect,
  InspectorTextInput,
  InspectorTextarea,
} from "@/components/site/builder/builder-inspector-primitives";
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
        <div className="space-y-2">
          <InspectorRow label={t("fields.headline")}>
            <InspectorTextInput value={block.headline} onChange={(v) => onChange({ headline: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.subheadline")}>
            <InspectorTextInput value={block.subheadline} onChange={(v) => onChange({ subheadline: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.ctaLabel")}>
            <InspectorTextInput value={block.ctaLabel} onChange={(v) => onChange({ ctaLabel: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.ctaHref")}>
            <InspectorTextInput value={block.ctaHref} onChange={(v) => onChange({ ctaHref: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.imageUrl")}>
            <InspectorTextInput
              value={block.imageUrl ?? ""}
              onChange={(v) => onChange({ imageUrl: v || undefined })}
            />
          </InspectorRow>
        </div>
      );
    case "about":
      return (
        <div className="space-y-2">
          <InspectorRow label={t("fields.title")}>
            <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
          </InspectorRow>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-[11px] text-slate-600">{t("fields.body")}</span>
            <InspectorTextarea value={block.body} onChange={(v) => onChange({ body: v })} rows={3} />
          </div>
        </div>
      );
    case "services":
      return (
        <div className="space-y-2">
          <InspectorRow label={t("fields.title")}>
            <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
          </InspectorRow>
          <InspectorCheckbox
            id={`${block.id}_prices`}
            label={t("fields.showPrices")}
            checked={block.showPrices}
            onChange={(showPrices) => onChange({ showPrices })}
          />
          <InspectorCheckbox
            id={`${block.id}_images`}
            label={t("fields.showImages")}
            checked={block.showImages ?? true}
            onChange={(showImages) => onChange({ showImages })}
          />
          <InspectorCheckbox
            id={`${block.id}_search`}
            label={t("fields.showSearch")}
            checked={block.showSearch ?? false}
            onChange={(showSearch) => onChange({ showSearch })}
          />
          <InspectorRow label={t("fields.limit")}>
            <InspectorTextInput
              type="number"
              min={1}
              max={24}
              value={block.limit}
              onChange={(v) => onChange({ limit: Number(v) })}
            />
          </InspectorRow>
        </div>
      );
    case "gallery":
      return <GalleryBlockFields block={block} onChange={onChange} t={t} />;
    case "contact":
      return (
        <div className="space-y-2">
          <InspectorRow label={t("fields.title")}>
            <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.phone")}>
            <InspectorTextInput value={block.phone} onChange={(v) => onChange({ phone: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.email")}>
            <InspectorTextInput value={block.email} onChange={(v) => onChange({ email: v })} />
          </InspectorRow>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-[11px] text-slate-600">{t("fields.address")}</span>
            <InspectorTextarea value={block.address} onChange={(v) => onChange({ address: v })} rows={2} />
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-[11px] text-slate-600">{t("fields.note")}</span>
            <InspectorTextarea value={block.note} onChange={(v) => onChange({ note: v })} rows={2} />
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-2">
          <InspectorRow label={t("fields.title")}>
            <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
          </InspectorRow>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-[11px] text-slate-600">{t("fields.body")}</span>
            <InspectorTextarea value={block.body} onChange={(v) => onChange({ body: v })} rows={2} />
          </div>
          <InspectorRow label={t("fields.ctaLabel")}>
            <InspectorTextInput value={block.buttonLabel} onChange={(v) => onChange({ buttonLabel: v })} />
          </InspectorRow>
          <InspectorRow label={t("fields.ctaHref")}>
            <InspectorTextInput value={block.buttonHref} onChange={(v) => onChange({ buttonHref: v })} />
          </InspectorRow>
        </div>
      );
    case "hours":
      return (
        <div className="space-y-2">
          <InspectorRow label={t("fields.title")}>
            <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
          </InspectorRow>
          <InspectorCheckbox
            id={`${block.id}_schedule`}
            label={t("fields.useSchedule")}
            checked={block.useSchedule ?? false}
            onChange={(useSchedule) => onChange({ useSchedule })}
          />
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-[11px] text-slate-600">{t("fields.hoursNote")}</span>
            <InspectorTextarea value={block.note} onChange={(v) => onChange({ note: v })} rows={2} />
          </div>
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
    <div className="space-y-2">
      <InspectorRow label={t("fields.title")}>
        <InspectorTextInput value={block.title} onChange={(v) => onChange({ title: v })} />
      </InspectorRow>
      <InspectorRow label={t("fields.columns")}>
        <InspectorSelect
          value={String(block.columns)}
          onChange={(v) => onChange({ columns: Number(v) as 2 | 3 | 4 })}
        >
          <option value="2">{t("fields.galleryCols2")}</option>
          <option value="3">{t("fields.galleryCols3")}</option>
          <option value="4">{t("fields.galleryCols4")}</option>
        </InspectorSelect>
      </InspectorRow>
      <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-600">
        <input type="file" accept="image/*" className="text-[10px]" onChange={handleUpload} disabled={uploading} />
        {uploading ? t("fields.uploading") : t("fields.addImage")}
      </label>
      <ul className="space-y-1.5">
        {block.images.map((img) => (
          <li key={img.id} className="flex gap-1.5 rounded border border-slate-100 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <InspectorTextInput
                value={img.caption ?? ""}
                onChange={(v) => updateImage(img.id, { caption: v })}
                placeholder={t("fields.caption")}
              />
              <button type="button" className="text-[10px] text-red-600" onClick={() => removeImage(img.id)}>
                {t("fields.removeImage")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
