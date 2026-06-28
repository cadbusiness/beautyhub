import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { PublicService } from "@/app/(public)/reserver/actions";
import type {
  SiteAboutBlock,
  SiteBlock,
  SiteCtaBlock,
  SiteHeroBlock,
  SiteHoursBlock,
  SiteServicesBlock,
  SiteTemplateId,
} from "@/lib/institut/site-pages";

function HeroBlock({
  block,
  template,
  accent,
}: {
  block: SiteHeroBlock;
  template: SiteTemplateId;
  accent: string;
}) {
  if (template === "modern") {
    return (
      <section className="bg-slate-900 px-4 py-16 text-white lg:px-6 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{block.headline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{block.subheadline}</p>
          <Link
            href={block.ctaHref}
            className="mt-8 inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium text-white"
            style={{ backgroundColor: accent }}
          >
            {block.ctaLabel}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-16 lg:px-6 lg:py-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Institut</p>
        <h1 className="mt-3 text-4xl font-serif text-slate-900 sm:text-5xl">{block.headline}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{block.subheadline}</p>
        <Link
          href={block.ctaHref}
          className="mt-8 inline-flex h-11 items-center rounded-full border px-6 text-sm font-medium transition-colors hover:bg-white"
          style={{ borderColor: accent, color: accent }}
        >
          {block.ctaLabel}
        </Link>
      </div>
    </section>
  );
}

function AboutBlock({ block, template }: { block: SiteAboutBlock; template: SiteTemplateId }) {
  return (
    <section className="px-4 py-12 lg:px-6 lg:py-16">
      <div className={`mx-auto max-w-5xl ${template === "elegant" ? "text-center" : ""}`}>
        <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2>
        <p className="mt-4 whitespace-pre-wrap text-slate-600 leading-relaxed">{block.body}</p>
      </div>
    </section>
  );
}

function ServicesBlock({
  block,
  services,
  template,
}: {
  block: SiteServicesBlock;
  services: PublicService[];
  template: SiteTemplateId;
}) {
  const items = services.slice(0, block.limit);

  return (
    <section className={`px-4 py-12 lg:px-6 lg:py-16 ${template === "modern" ? "bg-slate-50" : ""}`}>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((service) => (
            <Link
              key={service.id}
              href={`/reserver?service=${service.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <p className="font-medium text-slate-900">{service.name}</p>
              {service.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{service.description}</p>
              ) : null}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">{service.duration_min} min</span>
                {block.showPrices ? (
                  <span className="font-medium text-slate-900">
                    {formatPrice(service.price_cents)}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
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
    <section
      className={`px-4 py-12 lg:px-6 lg:py-16 ${template === "modern" ? "" : "bg-slate-50"}`}
    >
      <div
        className={`mx-auto max-w-5xl rounded-2xl px-6 py-10 ${
          template === "modern" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-center"
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

function HoursBlock({ block }: { block: SiteHoursBlock }) {
  return (
    <section className="px-4 py-12 lg:px-6">
      <div className="mx-auto max-w-5xl rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-slate-900">{block.title}</h2>
        <p className="mt-2 text-slate-600">{block.note}</p>
      </div>
    </section>
  );
}

export function SitePageRenderer({
  blocks,
  templateId,
  services,
  accent = "#0f172a",
}: {
  blocks: SiteBlock[];
  templateId: SiteTemplateId;
  services: PublicService[];
  accent?: string;
}) {
  return (
    <div>
      {blocks.map((block) => {
        switch (block.type) {
          case "hero":
            return (
              <HeroBlock key={block.id} block={block} template={templateId} accent={accent} />
            );
          case "about":
            return <AboutBlock key={block.id} block={block} template={templateId} />;
          case "services":
            return (
              <ServicesBlock
                key={block.id}
                block={block}
                services={services}
                template={templateId}
              />
            );
          case "cta":
            return <CtaBlock key={block.id} block={block} template={templateId} accent={accent} />;
          case "hours":
            return <HoursBlock key={block.id} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
