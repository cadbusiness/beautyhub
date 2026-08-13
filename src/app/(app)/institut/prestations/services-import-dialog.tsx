"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  importBooklyServicesAction,
  previewBooklyServicesImportAction,
  type ServiceImportActionResult,
} from "../service-import-actions";
import type { BooklyImportPreview } from "@/lib/institut/service-import/bookly-csv";

const initial: ServiceImportActionResult = {};

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PreviewPanel({ preview }: { preview: BooklyImportPreview }) {
  const t = useTranslations("institut.services.import");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("previewIntro")}</p>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <StatLine label={t("stats.total")} value={preview.totalRows} />
        <StatLine label={t("stats.categoriesCreate")} value={preview.categoriesToCreate} />
        <StatLine label={t("stats.categoriesUpdate")} value={preview.categoriesToUpdate} />
        <StatLine label={t("stats.create")} value={preview.servicesToCreate} />
        <StatLine label={t("stats.update")} value={preview.servicesToUpdate} />
        <StatLine label={t("stats.skip")} value={preview.skipped} />
      </div>

      {preview.samples.categories.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("samplesCategories")}
          </p>
          <p className="text-sm text-slate-700">{preview.samples.categories.join(" · ")}</p>
        </div>
      ) : null}

      {preview.samples.create.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("samplesCreate")}
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {preview.samples.create.map((row) => (
              <li key={row.booklyId} className="truncate">
                {row.title}
                {row.categoryName ? ` · ${row.categoryName}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ServicesImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("institut.services.import");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const [previewState, previewAction, previewPending] = useActionState(
    previewBooklyServicesImportAction,
    initial,
  );
  const [importState, importAction, importPending] = useActionState(
    importBooklyServicesAction,
    initial,
  );

  const preview = previewState.preview ?? importState.preview;
  const error = previewState.error ?? importState.error;
  const isDone = Boolean(importState.ok && importState.result);

  const canImport = useMemo(() => {
    if (!preview) return false;
    return preview.servicesToCreate > 0 || preview.servicesToUpdate > 0;
  }, [preview]);

  function reset() {
    setCsvContent("");
    setFileName("");
    setHasPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function readFile(file: File) {
    const text = await file.text();
    setCsvContent(text);
    setFileName(file.name);
    const fd = new FormData();
    fd.set("csv_content", text);
    previewAction(fd);
    setHasPreview(true);
  }

  function handleImport() {
    const fd = new FormData();
    fd.set("csv_content", csvContent);
    fd.set("confirm", "1");
    importAction(fd);
  }

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={isDone ? t("doneTitle") : t("title")}
      size="lg"
    >
      {!hasPreview && !isDone ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t("intro")}</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-slate-400">
            <span className="text-sm font-medium text-slate-800">{t("chooseFile")}</span>
            <span className="text-xs text-slate-500">{t("fileHint")}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
          {previewPending ? (
            <p className="text-sm text-slate-500">{t("analyzing")}</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {hasPreview && preview && !isDone ? (
        <div className="space-y-4">
          {fileName ? (
            <p className="text-xs text-slate-500">
              {t("fileLabel")}: {fileName}
            </p>
          ) : null}
          <PreviewPanel preview={preview} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={importPending}>
              {t("back")}
            </Button>
            <Button type="button" onClick={handleImport} disabled={!canImport || importPending}>
              {importPending ? t("importing") : t("confirmImport")}
            </Button>
          </div>
        </div>
      ) : null}

      {isDone && importState.result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {t("doneMessage", {
              created: importState.result.created,
              updated: importState.result.updated,
              categoriesCreated: importState.result.categoriesCreated,
              categoriesUpdated: importState.result.categoriesUpdated,
            })}
          </p>
          {importState.result.errors.length > 0 ? (
            <p className="text-sm text-amber-700">{importState.result.errors[0]}</p>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              handleClose();
              router.refresh();
            }}
          >
            {tCommon("close")}
          </Button>
        </div>
      ) : null}
    </FormDialog>
  );
}
