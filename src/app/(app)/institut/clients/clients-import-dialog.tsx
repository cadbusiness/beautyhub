"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  importOvercacheClientsAction,
  previewOvercacheImportAction,
  type ClientImportActionResult,
} from "../client-import-actions";
import type { OvercacheImportPreview } from "@/lib/institut/client-import/overcache-csv";

const initial: ClientImportActionResult = {};

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PreviewPanel({
  preview,
  quotaLimit,
  quotaUsage,
}: {
  preview: OvercacheImportPreview;
  quotaLimit: number | null | undefined;
  quotaUsage: number | undefined;
}) {
  const t = useTranslations("institut.clients.import");

  const quotaWarning =
    quotaLimit !== null &&
    quotaLimit !== undefined &&
    quotaUsage !== undefined &&
    quotaUsage + preview.toCreate > quotaLimit;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("previewIntro")}</p>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <StatLine label={t("stats.total")} value={preview.totalRows} />
        <StatLine label={t("stats.create")} value={preview.toCreate} />
        <StatLine label={t("stats.update")} value={preview.toUpdate} />
        <StatLine label={t("stats.skip")} value={preview.skipped} />
        <StatLine label={t("stats.withPhone")} value={preview.withPhone} />
      </div>

      {quotaWarning ? (
        <p className="text-sm text-amber-700">
          {t("quotaWarning", {
            usage: quotaUsage ?? 0,
            limit: quotaLimit ?? 0,
            needed: preview.toCreate,
          })}
        </p>
      ) : null}

      {preview.samples.create.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("samplesCreate")}
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {preview.samples.create.map((row) => (
              <li key={row.reference} className="truncate">
                {row.fullName} · {row.reference}
                {row.phone ? ` · ${row.phone}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.samples.skipped.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("samplesSkipped")}
          </p>
          <ul className="space-y-1 text-sm text-slate-500">
            {preview.samples.skipped.map((row) => (
              <li key={`${row.lineNumber}-${row.reference}`}>
                {t("skippedLine", {
                  line: row.lineNumber,
                  ref: row.reference,
                  reason: t(`skipReason.${row.reason}` as "skipReason.missing_reference"),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">{t("emailHint")}</p>
    </div>
  );
}

export function ClientsImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("institut.clients.import");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const [previewState, previewAction, previewPending] = useActionState(
    previewOvercacheImportAction,
    initial,
  );
  const [importState, importAction, importPending] = useActionState(
    importOvercacheClientsAction,
    initial,
  );

  const preview = previewState.preview ?? importState.preview;
  const error = previewState.error ?? importState.error;
  const isDone = Boolean(importState.ok && importState.result);

  const canImport = useMemo(() => {
    if (!preview) return false;
    if (preview.toCreate === 0 && preview.toUpdate === 0) return false;
    const limit = previewState.quotaLimit;
    const usage = previewState.quotaUsage;
    if (limit !== null && limit !== undefined && usage !== undefined) {
      if (usage + preview.toCreate > limit) return false;
    }
    return true;
  }, [preview, previewState.quotaLimit, previewState.quotaUsage]);

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
          <PreviewPanel
            preview={preview}
            quotaLimit={previewState.quotaLimit}
            quotaUsage={previewState.quotaUsage}
          />
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
              skipped: importState.result.skipped,
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
