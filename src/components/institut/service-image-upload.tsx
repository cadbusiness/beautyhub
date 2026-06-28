"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { removeServiceImage, uploadServiceImage } from "@/app/(app)/institut/prestations/image-actions";

export function ServiceImageUpload({
  serviceId,
  initialUrl,
  onUrlChange,
}: {
  serviceId: string;
  initialUrl: string | null;
  onUrlChange: (url: string | null) => void;
}) {
  const t = useTranslations("institut.services.dialog.image");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadServiceImage(serviceId, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPreview(res.url ?? null);
      onUrlChange(res.url ?? null);
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeServiceImage(serviceId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPreview(null);
      onUrlChange(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-32 w-full max-w-[200px] rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-32 w-full max-w-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          {t("noImage")}
        </div>
      )}

      <input type="hidden" name="image_url" value={preview ?? ""} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? t("uploading") : preview ? t("replace") : t("upload")}
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={handleRemove}>
            {t("remove")}
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <p className="text-xs text-slate-500">{t("hint")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
