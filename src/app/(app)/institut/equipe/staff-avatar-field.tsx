"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { removeStaffAvatar, uploadStaffAvatar } from "./staff-image-actions";

export function StaffAvatarField({
  staffId,
  name,
  color,
  initialUrl,
  onPendingFile,
}: {
  staffId?: string;
  name?: string | null;
  color?: string | null;
  initialUrl?: string | null;
  onPendingFile?: (file: File | null) => void;
}) {
  const t = useTranslations("institut.team.personnel.form.avatar");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setFile(file: File | null) {
    setPendingFile(file);
    onPendingFile?.(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(initialUrl ?? null);
    }
  }

  function handleUpload(file: File) {
    if (!staffId) {
      setFile(file);
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadStaffAvatar(staffId, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPreview(res.url ?? null);
      setPendingFile(null);
      onPendingFile?.(null);
    });
  }

  function handleRemove() {
    if (!staffId) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await removeStaffAvatar(staffId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPreview(null);
      setPendingFile(null);
      onPendingFile?.(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  const hasImage = Boolean(preview);

  return (
    <div className="flex items-start gap-4">
      <StaffAvatar name={name} color={color} imageUrl={preview} size="lg" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? t("uploading") : hasImage ? t("replace") : t("upload")}
          </Button>
          {hasImage ? (
            <Button type="button" variant="ghost" className="h-9" disabled={pending} onClick={handleRemove}>
              {t("remove")}
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) handleUpload(file);
          }}
        />
        {!staffId && pendingFile ? (
          <p className="text-xs text-emerald-700">{t("pendingUpload")}</p>
        ) : null}
        <p className="text-xs text-slate-500">{t("hint")}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
