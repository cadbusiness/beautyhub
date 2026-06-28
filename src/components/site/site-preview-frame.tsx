"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function SitePreviewFrame({
  src,
  title,
}: {
  src: string;
  title?: string;
}) {
  const t = useTranslations("institut.marketing.website.previewPanel");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{title ?? t("title")}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={device === "desktop" ? "primary" : "outline"}
            className="h-8 px-3 text-xs"
            onClick={() => setDevice("desktop")}
          >
            {t("desktop")}
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "primary" : "outline"}
            className="h-8 px-3 text-xs"
            onClick={() => setDevice("mobile")}
          >
            {t("mobile")}
          </Button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50"
          >
            {t("openFull")}
          </a>
        </div>
      </div>
      <div className="flex justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
        <iframe
          src={src}
          title={title ?? t("title")}
          className={`h-[min(70vh,720px)] rounded-lg border border-slate-200 bg-white shadow-sm transition-all ${
            device === "mobile" ? "w-[375px]" : "w-full max-w-5xl"
          }`}
        />
      </div>
    </div>
  );
}
