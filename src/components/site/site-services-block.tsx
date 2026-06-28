"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { PublicService } from "@/lib/public/booking-load";
import type { SiteServicesBlock, SiteTemplateId } from "@/lib/institut/site-pages";
import { Input } from "@/components/ui/input";

export function SiteServicesBlockView({
  block,
  services,
  template,
}: {
  block: SiteServicesBlock;
  services: PublicService[];
  template: SiteTemplateId;
}) {
  const [query, setQuery] = useState("");
  const showImages = block.showImages ?? true;
  const showSearch = block.showSearch ?? false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = services;
    if (q) {
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return items.slice(0, block.limit);
  }, [services, query, block.limit]);

  return (
    <section className={`px-4 py-12 lg:px-6 lg:py-16 ${template === "modern" ? "bg-slate-50" : ""}`}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2>
          {showSearch ? (
            <Input
              type="search"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 sm:max-w-xs"
            />
          ) : null}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <Link
              key={service.id}
              href={`/reserver?service=${service.id}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
            >
              {showImages && service.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.image_url}
                  alt=""
                  className="h-36 w-full object-cover"
                />
              ) : null}
              <div className="p-5">
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
              </div>
            </Link>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Aucune prestation trouvée.</p>
        ) : null}
      </div>
    </section>
  );
}
