import Link from "next/link";
import type { PublicService } from "@/lib/public/booking-load";
import type {
  SiteAboutBlock,
  SiteBlock,
  SiteContactBlock,
  SiteCtaBlock,
  SiteGalleryBlock,
  SiteHeroBlock,
  SiteHoursBlock,
  SiteServicesBlock,
  SiteTemplateId,
} from "@/lib/institut/site-pages";
import { normalizeHoursBlock, normalizeServicesBlock } from "@/lib/institut/site-pages";
import { SiteServicesBlockView } from "./site-services-block";

export interface FormattedOpeningDay {
  label: string;
  ranges: string;
}

function HeroBlock({
  block,
  template,
  accent,
  compact = false,
}: {
  block: SiteHeroBlock;
  template: SiteTemplateId;
  accent: string;
  compact?: boolean;
}) {
  const py = compact ? "py-10 lg:py-12" : "py-16 lg:py-24";
  const ctaHref = block.ctaHref;

  if (template === "modern") {
    return (
      <section
        className={`relative bg-slate-900 px-4 text-white lg:px-6 ${py}`}
        style={
          block.imageUrl
            ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,0.75), rgba(15,23,42,0.75)), url(${block.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{block.headline}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">{block.subheadline}</p>
          {!compact && ctaHref !== "#booking" ? (
            <Link
              href={ctaHref}
              className="mt-6 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium text-white"
              style={{ backgroundColor: accent }}
            >
              {block.ctaLabel}
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`border-b border-slate-200 bg-slate-50 px-4 lg:px-6 ${py}`}
      style={
        block.imageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(248,250,252,0.92), rgba(248,250,252,0.92)), url(${block.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className={`mx-auto max-w-5xl ${compact ? "text-left" : "text-center"}`}>
        {!compact ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Institut</p>
        ) : null}
        <h1 className={`${compact ? "text-3xl" : "mt-3 text-4xl font-serif sm:text-5xl"} font-semibold text-slate-900`}>
          {block.headline}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">{block.subheadline}</p>
        {!compact && ctaHref !== "#booking" ? (
          <Link
            href={ctaHref}
            className="mt-6 inline-flex h-11 items-center rounded-full border px-6 text-sm font-medium"
            style={{ borderColor: accent, color: accent }}
          >
            {block.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function AboutBlock({ block, template }: { block: SiteAboutBlock; template: SiteTemplateId }) {
  return (
    <section className="px-4 py-10 lg:px-6 lg:py-12">
      <div className={`mx-auto max-w-5xl ${template === "elegant" ? "text-center" : ""}`}>
        <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2>
        <p className="mt-4 whitespace-pre-wrap text-slate-600 leading-relaxed">{block.body}</p>
      </div>
    </section>
  );
}

function GalleryBlock({ block }: { block: SiteGalleryBlock }) {
  const cols =
    block.columns === 4
      ? "grid-cols-2 lg:grid-cols-4"
      : block.columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <section className="px-4 py-12 lg:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2>
        {block.images.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune image.</p>
        ) : (
          <div className={`mt-8 grid gap-3 ${cols}`}>
            {block.images.map((img) => (
              <figure key={img.id} className="overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption ?? ""} className="aspect-[4/3] w-full object-cover" />
                {img.caption ? (
                  <figcaption className="px-3 py-2 text-sm text-slate-600">{img.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HoursBlock({
  block,
  scheduleDays,
}: {
  block: SiteHoursBlock;
  scheduleDays: FormattedOpeningDay[];
}) {
  const normalized = normalizeHoursBlock(block);

  return (
    <section className="px-4 py-12 lg:px-6">
      <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>
        {normalized.useSchedule && scheduleDays.length > 0 ? (
          <dl className="mt-4 space-y-2">
            {scheduleDays.map((day) => (
              <div key={day.label} className="flex justify-between gap-4 text-sm">
                <dt className="font-medium text-slate-700">{day.label}</dt>
                <dd className="text-slate-600">{day.ranges}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-slate-600">{block.note || "Horaires sur rendez-vous."}</p>
        )}
        {block.note && normalized.useSchedule ? (
          <p className="mt-4 text-sm text-slate-500">{block.note}</p>
        ) : null}
      </div>
    </section>
  );
}

function ContactBlock({ block }: { block: SiteContactBlock }) {
  return (
    <section className="px-4 py-12 lg:px-6">
      <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {block.phone ? <li>Tél. {block.phone}</li> : null}
          {block.email ? (
            <li>
              <a href={`mailto:${block.email}`} className="underline">
                {block.email}
              </a>
            </li>
          ) : null}
          {block.address ? <li className="whitespace-pre-wrap">{block.address}</li> : null}
        </ul>
        {block.note ? <p className="mt-4 text-sm text-slate-500">{block.note}</p> : null}
      </div>
    </section>
  );
}

function CtaBlock({
  block,
  template,
  accent,
}: {
  block: SiteCtaBlock;
  template: SiteTemplateId;
  accent: string;
}) {
  return (
    <section className={`px-4 py-12 lg:px-6 lg:py-16 ${template === "modern" ? "" : "bg-slate-50"}`}>
      <div
        className={`mx-auto max-w-5xl rounded-2xl px-6 py-10 ${
          template === "modern"
            ? "bg-slate-900 text-white"
            : "border border-slate-200 bg-white text-center"
        }`}
      >
        <h2 className="text-2xl font-semibold">{block.title}</h2>
        <p className={`mt-3 ${template === "modern" ? "text-slate-300" : "text-slate-600"}`}>
          {block.body}
        </p>
        <Link
          href={block.buttonHref}
          className={`mt-6 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium ${
            template === "modern" ? "bg-white text-slate-900" : "text-white"
          }`}
          style={template === "modern" ? undefined : { backgroundColor: accent }}
        >
          {block.buttonLabel}
        </Link>
      </div>
    </section>
  );
}

export function SitePageRenderer({
  blocks,
  templateId,
  services,
  scheduleDays = [],
  accent = "#0f172a",
  compactHero = false,
}: {
  blocks: SiteBlock[];
  templateId: SiteTemplateId;
  services: PublicService[];
  scheduleDays?: FormattedOpeningDay[];
  accent?: string;
  compactHero?: boolean;
}) {
  return (
    <div>
      {blocks.map((block) => {
        switch (block.type) {
          case "hero":
            return (
              <HeroBlock
                key={block.id}
                block={block}
                template={templateId}
                accent={accent}
                compact={compactHero}
              />
            );
          case "about":
            return <AboutBlock key={block.id} block={block} template={templateId} />;
          case "services":
            return (
              <SiteServicesBlockView
                key={block.id}
                block={normalizeServicesBlock(block)}
                services={services}
                template={templateId}
              />
            );
          case "gallery":
            return <GalleryBlock key={block.id} block={block} />;
          case "hours":
            return <HoursBlock key={block.id} block={block} scheduleDays={scheduleDays} />;
          case "contact":
            return <ContactBlock key={block.id} block={block} />;
          case "cta":
            return (
              <CtaBlock key={block.id} block={block} template={templateId} accent={accent} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
