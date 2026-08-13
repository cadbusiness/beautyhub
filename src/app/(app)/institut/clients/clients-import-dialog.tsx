"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  buildRovercashImportRow,
  parseRovercashCsv,
  previewRovercashImport,
  rovercashSkipReason,
  type RovercashCsvRow,
  type RovercashImportPreview,
  type RovercashImportRow,
} from "@/lib/institut/client-import/rovercash-csv";

const BATCH_SIZE = 200;

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
  preview: RovercashImportPreview;
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

type ImportStatus = {
  quotaLimit: number | null;
  quotaUsage: number;
  existingRefs: string[];
};

type Progress = {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
};

const emptyProgress: Progress = {
  processed: 0,
  created: 0,
  updated: 0,
  errors: [],
};

function buildRowsToSend(
  csvRows: RovercashCsvRow[],
  tenantSlug: string,
  limit?: number,
): RovercashImportRow[] {
  const seen = new Set<string>();
  const rows: RovercashImportRow[] = [];
  for (const csvRow of csvRows) {
    if (rovercashSkipReason(csvRow)) continue;
    if (seen.has(csvRow.reference)) continue;
    seen.add(csvRow.reference);
    rows.push(buildRovercashImportRow(csvRow, tenantSlug));
    if (limit && rows.length >= limit) break;
  }
  return rows;
}

export function ClientsImportDialog({
  open,
  onClose,
  tenantSlug,
}: {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
}) {
  const t = useTranslations("institut.clients.import");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [csvRows, setCsvRows] = useState<RovercashCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<RovercashImportPreview | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<number | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [done, setDone] = useState(false);

  const canTest = useMemo(() => {
    if (!preview) return false;
    if (preview.toCreate === 0 && preview.toUpdate === 0) return false;
    if (quotaLimit !== null && quotaLimit !== undefined && quotaUsage !== undefined) {
      if (quotaUsage + 5 > quotaLimit) return false;
    }
    return true;
  }, [preview, quotaLimit, quotaUsage]);

  const canImport = useMemo(() => {
    if (!preview) return false;
    if (preview.toCreate === 0 && preview.toUpdate === 0) return false;
    if (quotaLimit !== null && quotaLimit !== undefined && quotaUsage !== undefined) {
      if (quotaUsage + preview.toCreate > quotaLimit) return false;
    }
    return true;
  }, [preview, quotaLimit, quotaUsage]);

  const percent = useMemo(() => {
    if (totalToProcess === 0) return 0;
    return Math.min(100, Math.round((progress.processed / totalToProcess) * 100));
  }, [progress.processed, totalToProcess]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCsvRows([]);
    setFileName("");
    setPreview(null);
    setError(null);
    setQuotaLimit(null);
    setQuotaUsage(undefined);
    setImporting(false);
    setProgress(emptyProgress);
    setTotalToProcess(0);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  async function readFile(file: File) {
    setAnalyzing(true);
    setError(null);
    setPreview(null);
    setDone(false);

    try {
      const text = await file.text();
      const { rows, errors: parseErrors } = parseRovercashCsv(text);
      if (parseErrors.includes("missing_columns")) {
        setError(t("errors.missingColumns"));
        return;
      }
      if (rows.length === 0) {
        setError(t("errors.invalidFile"));
        return;
      }

      setCsvRows(rows);
      setFileName(file.name);

      let existingRefs = new Set<string>();
      try {
        const statusRes = await fetch("/api/institut/clients/import-status", {
          credentials: "include",
        });
        if (statusRes.ok) {
          const status = (await statusRes.json()) as ImportStatus;
          setQuotaLimit(status.quotaLimit);
          setQuotaUsage(status.quotaUsage);
          existingRefs = new Set(status.existingRefs ?? []);
        }
      } catch {
        // Preview still works without quota / existing refs.
      }

      setPreview(previewRovercashImport(rows, tenantSlug, existingRefs));
    } catch (readError) {
      console.error("[clients-import-dialog]", readError);
      setError(t("errors.invalidFile"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function runImport(rowsToSend: RovercashImportRow[]) {
    if (rowsToSend.length === 0) return;
    setImporting(true);
    setError(null);
    setDone(false);
    setProgress(emptyProgress);
    setTotalToProcess(rowsToSend.length);

    const controller = new AbortController();
    abortRef.current = controller;

    const aggregate: Progress = { processed: 0, created: 0, updated: 0, errors: [] };

    for (let start = 0; start < rowsToSend.length; start += BATCH_SIZE) {
      if (controller.signal.aborted) break;
      const batch = rowsToSend.slice(start, start + BATCH_SIZE);

      try {
        const res = await fetch("/api/institut/clients/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
            kind?: string;
          };
          if (payload.kind === "quota") {
            aggregate.errors.push(payload.error ?? t("errors.importFailed"));
            setProgress({ ...aggregate });
            setError(payload.error ?? t("errors.importFailed"));
            break;
          }
          aggregate.errors.push(payload.error ?? `HTTP ${res.status}`);
          aggregate.processed += batch.length;
          setProgress({ ...aggregate });
          continue;
        }

        const data = (await res.json()) as {
          created: number;
          updated: number;
          errors: string[];
        };
        aggregate.created += data.created ?? 0;
        aggregate.updated += data.updated ?? 0;
        if (data.errors && data.errors.length > 0) {
          aggregate.errors.push(...data.errors);
        }
        aggregate.processed += batch.length;
        setProgress({ ...aggregate });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") break;
        console.error("[clients-import-dialog]", err);
        aggregate.errors.push(err instanceof Error ? err.message : String(err));
        aggregate.processed += batch.length;
        setProgress({ ...aggregate });
      }
    }

    setImporting(false);
    setDone(true);
    abortRef.current = null;
  }

  function handleImport(limit?: number) {
    if (csvRows.length === 0) return;
    const rows = buildRowsToSend(csvRows, tenantSlug, limit);
    void runImport(rows);
  }

  function handleAbort() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={done ? t("doneTitle") : t("title")}
      size="lg"
    >
      {!preview && !done ? (
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
          {analyzing ? <p className="text-sm text-slate-500">{t("analyzing")}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {preview && !done && !importing ? (
        <div className="space-y-4">
          {fileName ? (
            <p className="text-xs text-slate-500">
              {t("fileLabel")}: {fileName}
            </p>
          ) : null}
          <PreviewPanel preview={preview} quotaLimit={quotaLimit} quotaUsage={quotaUsage} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              {t("back")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleImport(5)}
              disabled={!canTest}
            >
              {t("testImport")}
            </Button>
            <Button type="button" onClick={() => handleImport()} disabled={!canImport}>
              {t("confirmImport")}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{t("testImportHint")}</p>
        </div>
      ) : null}

      {importing ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="font-medium">{t("progressTitle")}</span>
              <span className="tabular-nums">
                {progress.processed} / {totalToProcess} · {percent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.create")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.created}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.update")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.updated}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("progressErrors")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.errors.length}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">{t("progressHint")}</p>
          <Button type="button" variant="outline" onClick={handleAbort}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}

      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {t("doneMessage", {
              created: progress.created,
              updated: progress.updated,
              skipped: preview?.skipped ?? 0,
            })}
          </p>
          {progress.errors.length > 0 ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {t("progressErrors")}: {progress.errors.length}
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                {progress.errors.slice(0, 20).map((message, idx) => (
                  <li key={idx} className="truncate">
                    · {message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
              }}
            >
              {t("importAnother")}
            </Button>
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
        </div>
      ) : null}
    </FormDialog>
  );
}
