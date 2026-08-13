"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  parseBooklyServicesCsv,
  previewBooklyImport,
  type BooklyImportPreview,
  type BooklyImportResult,
  type BooklyServiceCsvRow,
} from "@/lib/institut/service-import/bookly-csv";

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

type CatalogSnapshot = {
  categories: Array<{
    id: string;
    name: string;
    bookly_id: number | null;
    sort_order: number;
  }>;
  services: Array<{
    id: string;
    name: string;
    bookly_id: number | null;
    category_id: string | null;
  }>;
};

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

  const [csvRows, setCsvRows] = useState<BooklyServiceCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<BooklyImportPreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BooklyImportResult | null>(null);

  const reset = useCallback(() => {
    setCsvRows([]);
    setFileName("");
    setPreview(null);
    setError(null);
    setResult(null);
    setImporting(false);
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
    setResult(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const { rows, errors: parseErrors } = parseBooklyServicesCsv(text);

      if (parseErrors.includes("missing_columns")) {
        setError(t("errors.missingColumns"));
        return;
      }
      if (parseErrors.includes("empty_file") || rows.length === 0) {
        setError(t("errors.invalidFile"));
        return;
      }

      let catalog: CatalogSnapshot = { categories: [], services: [] };
      try {
        const res = await fetch("/api/institut/services/import-status", {
          credentials: "include",
        });
        if (res.ok) {
          catalog = (await res.json()) as CatalogSnapshot;
        }
      } catch {
        // Preview still works without existing catalog (all rows will be creates).
      }

      setCsvRows(rows);
      setPreview(previewBooklyImport(rows, catalog));
    } catch (err) {
      console.error("[services-import-dialog]", err);
      setError(t("errors.invalidFile"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImport() {
    if (csvRows.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/institut/services/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvRows }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? t("errors.importFailed"));
        return;
      }

      const data = (await res.json()) as BooklyImportResult;
      setResult(data);
    } catch (err) {
      console.error("[services-import-dialog]", err);
      setError(t("errors.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  const canImport =
    preview !== null &&
    (preview.servicesToCreate > 0 || preview.servicesToUpdate > 0);

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={result ? t("doneTitle") : t("title")}
      size="lg"
    >
      {!preview && !result ? (
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

      {preview && !result ? (
        <div className="space-y-4">
          {fileName ? (
            <p className="text-xs text-slate-500">
              {t("fileLabel")}: {fileName}
            </p>
          ) : null}
          <PreviewPanel preview={preview} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={importing}>
              {t("back")}
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!canImport || importing}
            >
              {importing ? t("importing") : t("confirmImport")}
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {t("doneMessage", {
              created: result.created,
              updated: result.updated,
              categoriesCreated: result.categoriesCreated,
              categoriesUpdated: result.categoriesUpdated,
            })}
          </p>
          {result.errors.length > 0 ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                Erreurs ({result.errors.length})
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                {result.errors.slice(0, 20).map((message, idx) => (
                  <li key={idx} className="truncate">
                    · {message}
                  </li>
                ))}
              </ul>
            </details>
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
