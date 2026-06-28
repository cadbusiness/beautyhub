"use client";

import type { SiteMediaKind } from "@/lib/institut/site-media-upload";
import { cn } from "@/lib/utils";

export function BuilderMediaUpload({
  accept,
  previewUrl,
  previewKind = "image",
  uploading,
  uploadLabel,
  removeLabel,
  hint,
  onUpload,
  onRemove,
}: {
  accept: string;
  previewUrl?: string;
  previewKind?: SiteMediaKind;
  uploading: boolean;
  uploadLabel: string;
  removeLabel: string;
  hint?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div className="overflow-hidden rounded border border-slate-200 bg-slate-50">
          {previewKind === "video" ? (
            <video src={previewUrl} muted playsInline controls className="max-h-28 w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="max-h-28 w-full object-cover" />
          )}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
            <span className="truncate text-[10px] text-slate-500">
              {previewKind === "video" ? "Vidéo" : "Image"}
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-[10px] text-red-600 hover:text-red-700"
            >
              {removeLabel}
            </button>
          </div>
        </div>
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-200 bg-white px-3 py-3 text-center transition hover:border-slate-300 hover:bg-slate-50",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
          disabled={uploading}
        />
        <span className="text-[11px] font-medium text-slate-700">
          {uploading ? "…" : uploadLabel}
        </span>
        {hint ? <span className="mt-0.5 text-[10px] text-slate-400">{hint}</span> : null}
      </label>
    </div>
  );
}
