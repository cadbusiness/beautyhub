"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { saveSitePageBuilder, uploadSiteGalleryImage, type ActionResult } from "./site-actions";
import { loadPublicServices, type PublicService } from "@/app/(public)/reserver/actions";
import {
  SitePageRenderer,
  type FormattedOpeningDay,
} from "@/components/site/site-page-renderer";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  SITE_BLOCK_TYPES,
  SITE_TEMPLATES,
  type SiteBlock,
  type SiteBlockType,
  type SiteGalleryBlock,
  type SiteGalleryImage,
  type SitePageRow,
  type SiteTemplateId,
} from "@/lib/institut/site-pages";

const initial: ActionResult = {};

function newBlock(type: SiteBlockType): SiteBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "hero":
      return {
        id,
        type,
        headline: "Titre",
        subheadline: "Sous-titre",
        ctaLabel: "Réserver",
        ctaHref: "/reserver",
      };
    case "about":
      return { id, type, title: "À propos", body: "Texte de présentation…" };
    case "services":
      return {
        id,
        type,
        title: "Prestations",
        showPrices: true,
        showImages: true,
        showSearch: false,
        limit: 6,
      };
    case "gallery":
      return { id, type, title: "Galerie", images: [], columns: 3 };
    case "contact":
      return {
        id,
        type,
        title: "Nous contacter",
        phone: "",
        email: "",
        address: "",
        note: "",
      };
    case "cta":
      return {
        id,
        type,
        title: "Appel à l'action",
        body: "Réservez votre créneau.",
        buttonLabel: "Réserver",
        buttonHref: "/reserver",
      };
    case "hours":
      return { id, type, title: "Horaires", note: "Sur rendez-vous.", useSchedule: false };
  }
}

export function SitePageBuilder({
  page,
  previewServices,
  scheduleDays = [],
}: {
  page: SitePageRow;
  previewServices: PublicService[];
  scheduleDays?: FormattedOpeningDay[];
}) {
  const t = useTranslations("institut.marketing.website.builder");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveSitePageBuilder, initial);
  const [templateId, setTemplateId] = useState<SiteTemplateId>(page.template_id);
  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState<SiteBlock[]>(page.content);
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo_description ?? "");
  const [published, setPublished] = useState(page.is_published);
  const [services, setServices] = useState<PublicService[]>(previewServices);

  useEffect(() => {
    if (previewServices.length === 0) {
      loadPublicServices().then(setServices);
    }
  }, [previewServices.length]);

  const blocksJson = useMemo(() => JSON.stringify(blocks), [blocks]);

  function updateBlock(id: string, patch: Partial<SiteBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...patch } as SiteBlock) : b)),
    );
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function addBlock(type: SiteBlockType) {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[420px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <Link
              href="/institut/marketing/page-web"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ← {t("back")}
            </Link>
            <p className="font-medium text-slate-900">{page.title}</p>
          </div>
        </div>

        <form action={action} className="space-y-6 overflow-y-auto px-4 py-4 lg:max-h-[calc(100dvh-8rem)]">
          <input type="hidden" name="id" value={page.id} />
          <input type="hidden" name="template_id" value={templateId} />
          <input type="hidden" name="blocks_json" value={blocksJson} />

          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-green-600">{state.message ?? t("saved")}</p> : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{t("template")}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {SITE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-lg border p-3 text-left text-sm ${
                    templateId === tpl.id
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium">{t(`templates.${tpl.id}`)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(`templates.${tpl.id}Desc`)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Field label={t("pageTitle")} htmlFor="site_title">
              <Input
                id="site_title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field label={t("seoTitle")} htmlFor="seo_title">
              <Input
                id="seo_title"
                name="seo_title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
              />
            </Field>
            <Field label={t("seoDescription")} htmlFor="seo_description">
              <Textarea
                id="seo_description"
                name="seo_description"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_published"
                value="1"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              {t("published")}
            </label>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{t("blocks")}</h3>
              <Select
                className="h-9 w-auto text-sm"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value as SiteBlockType;
                  if (v) addBlock(v);
                  e.target.value = "";
                }}
              >
                <option value="">{t("addBlock")}</option>
                {SITE_BLOCK_TYPES.map((b) => (
                  <option key={b.type} value={b.type}>
                    {t(`blockTypes.${b.type}`)}
                  </option>
                ))}
              </Select>
            </div>

            <ul className="space-y-3">
              {blocks.map((block, index) => (
                <li key={block.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-slate-500">
                      {t(`blockTypes.${block.type}`)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs text-slate-500"
                        disabled={index === 0}
                        onClick={() => moveBlock(block.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-xs text-slate-500"
                        disabled={index === blocks.length - 1}
                        onClick={() => moveBlock(block.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => removeBlock(block.id)}
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                  </div>
                  <BlockFields
                    block={block}
                    onChange={(patch) => updateBlock(block.id, patch)}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          </section>

          <Button type="submit" className="h-9 w-full" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </div>

      <div className="min-h-[480px] flex-1 overflow-y-auto bg-slate-100">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          {t("previewLabel")}
        </div>
        <SitePageRenderer
          blocks={blocks}
          templateId={templateId}
          services={services}
          scheduleDays={scheduleDays}
          accent="#0f172a"
        />
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  t,
}: {
  block: SiteBlock;
  onChange: (patch: Partial<SiteBlock>) => void;
  t: ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-2">
          <Input value={block.headline} onChange={(e) => onChange({ headline: e.target.value })} placeholder={t("fields.headline")} />
          <Input value={block.subheadline} onChange={(e) => onChange({ subheadline: e.target.value })} placeholder={t("fields.subheadline")} />
          <Input value={block.ctaLabel} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder={t("fields.ctaLabel")} />
          <Input value={block.ctaHref} onChange={(e) => onChange({ ctaHref: e.target.value })} placeholder={t("fields.ctaHref")} />
          <Input
            value={block.imageUrl ?? ""}
            onChange={(e) => onChange({ imageUrl: e.target.value || undefined })}
            placeholder={t("fields.imageUrl")}
          />
        </div>
      );
    case "about":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} rows={3} />
        </div>
      );
    case "services":
      return (
        <div className="space-y-2">
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
      return (
        <GalleryBlockFields block={block} onChange={onChange} t={t} />
      );
    case "contact":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Input value={block.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder={t("fields.phone")} />
          <Input value={block.email} onChange={(e) => onChange({ email: e.target.value })} placeholder={t("fields.email")} />
          <Textarea value={block.address} onChange={(e) => onChange({ address: e.target.value })} rows={2} placeholder={t("fields.address")} />
          <Textarea value={block.note} onChange={(e) => onChange({ note: e.target.value })} rows={2} placeholder={t("fields.note")} />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <Textarea value={block.body} onChange={(e) => onChange({ body: e.target.value })} rows={2} />
          <Input value={block.buttonLabel} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
          <Input value={block.buttonHref} onChange={(e) => onChange({ buttonHref: e.target.value })} />
        </div>
      );
    case "hours":
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.useSchedule ?? false}
              onChange={(e) => onChange({ useSchedule: e.target.checked })}
            />
            {t("fields.useSchedule")}
          </label>
          <Textarea value={block.note} onChange={(e) => onChange({ note: e.target.value })} rows={2} placeholder={t("fields.hoursNote")} />
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
  t: ReturnType<typeof useTranslations<"institut.marketing.website.builder">>;
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
