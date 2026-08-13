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
import {
  isBooklyExtrasCsv,
  parseBooklyExtrasCsv,
  previewBooklyExtrasImport,
  type BooklyExtraCsvRow,
  type BooklyExtrasImportPreview,
  type BooklyExtrasImportResult,
} from "@/lib/institut/service-import/bookly-extras-csv";

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ServicesPreview({ preview }: { preview: BooklyImportPreview }) {
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

function ExtrasPreview({ preview }: { preview: BooklyExtrasImportPreview }) {
  const t = useTranslations("institut.services.importExtras");
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("previewIntro")}</p>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <StatLine label={t("stats.total")} value={preview.totalRows} />
        <StatLine label={t("stats.extrasCreate")} value={preview.extrasToCreate} />
        <StatLine label={t("stats.extrasReused")} value={preview.extrasReused} />
        <StatLine label={t("stats.linksCreate")} value={preview.linksToCreate} />
        <StatLine label={t("stats.linksUpdate")} value={preview.linksToUpdate} />
        {preview.linksMissingService > 0 ? (
          <StatLine
            label={t("stats.linksMissing")}
            value={preview.linksMissingService}
          />
        ) : null}
      </div>
      {preview.linksMissingService > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t("missingServiceHint")}
        </p>
      ) : null}
      {preview.samples.create.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("samplesCreate")}
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {preview.samples.create.map((row) => (
              <li key={row.booklyExtraId} className="truncate">
                {row.title}
                {row.serviceTitle ? ` → ${row.serviceTitle}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type ServicesCatalog = {
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

type ExtrasCatalog = {
  services: Array<{
    id: string;
    name: string;
    bookly_id: number | null;
    visibility: string;
  }>;
  links: Array<{ service_id: string; extra_service_id: string }>;
};

type Mode = "services" | "extras";

type CombinedResult =
  | { mode: "services"; data: BooklyImportResult }
  | { mode: "extras"; data: BooklyExtrasImportResult };

export function ServicesImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("institut.services.import");
  const tExtras = useTranslations("institut.services.importExtras");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("services");
  const [csvServiceRows, setCsvServiceRows] = useState<BooklyServiceCsvRow[]>([]);
  const [csvExtraRows, setCsvExtraRows] = useState<BooklyExtraCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [servicesPreview, setServicesPreview] = useState<BooklyImportPreview | null>(null);
  const [extrasPreview, setExtrasPreview] = useState<BooklyExtrasImportPreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedResult | null>(null);

  const reset = useCallback(() => {
    setMode("services");
    setCsvServiceRows([]);
    setCsvExtraRows([]);
    setFileName("");
    setServicesPreview(null);
    setExtrasPreview(null);
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
    setServicesPreview(null);
    setExtrasPreview(null);
    setResult(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const isExtras = isBooklyExtrasCsv(text);
      setMode(isExtras ? "extras" : "services");

      if (isExtras) {
        const { rows, errors: parseErrors } = parseBooklyExtrasCsv(text);
        if (parseErrors.includes("missing_columns")) {
          setError(tExtras("errors.missingColumns"));
          return;
        }
        if (parseErrors.includes("empty_file") || rows.length === 0) {
          setError(tExtras("errors.invalidFile"));
          return;
        }

        let catalog: ExtrasCatalog = { services: [], links: [] };
        try {
          const res = await fetch("/api/institut/services/import-extras", {
            credentials: "include",
          });
          if (res.ok) {
            catalog = (await res.json()) as ExtrasCatalog;
          }
        } catch {
          // Preview works with empty catalog.
        }

        setCsvExtraRows(rows);
        setExtrasPreview(previewBooklyExtrasImport(rows, catalog));
      } else {
        const { rows, errors: parseErrors } = parseBooklyServicesCsv(text);
        if (parseErrors.includes("missing_columns")) {
          setError(t("errors.missingColumns"));
          return;
        }
        if (parseErrors.includes("empty_file") || rows.length === 0) {
          setError(t("errors.invalidFile"));
          return;
        }

        let catalog: ServicesCatalog = { categories: [], services: [] };
        try {
          const res = await fetch("/api/institut/services/import-status", {
            credentials: "include",
          });
          if (res.ok) {
            catalog = (await res.json()) as ServicesCatalog;
          }
        } catch {
          // Preview works with empty catalog.
        }

        setCsvServiceRows(rows);
        setServicesPreview(previewBooklyImport(rows, catalog));
      }
    } catch (err) {
      console.error("[services-import-dialog]", err);
      setError(mode === "extras" ? tExtras("errors.invalidFile") : t("errors.invalidFile"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);

    try {
      if (mode === "extras") {
        if (csvExtraRows.length === 0) return;
        const res = await fetch("/api/institut/services/import-extras", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: csvExtraRows }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setError(payload.error ?? tExtras("errors.importFailed"));
          return;
        }
        const data = (await res.json()) as BooklyExtrasImportResult;
        setResult({ mode: "extras", data });
      } else {
        if (csvServiceRows.length === 0) return;
        const res = await fetch("/api/institut/services/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: csvServiceRows }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setError(payload.error ?? t("errors.importFailed"));
          return;
        }
        const data = (await res.json()) as BooklyImportResult;
        setResult({ mode: "services", data });
      }
    } catch (err) {
      console.error("[services-import-dialog]", err);
      setError(mode === "extras" ? tExtras("errors.importFailed") : t("errors.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  const hasPreview = servicesPreview !== null || extrasPreview !== null;
  const canImport = servicesPreview
    ? servicesPreview.servicesToCreate > 0 || servicesPreview.servicesToUpdate > 0
    : extrasPreview
      ? extrasPreview.extrasToCreate > 0 ||
        extrasPreview.linksToCreate > 0 ||
        extrasPreview.linksToUpdate > 0
      : false;

  const dialogTitle = result
    ? mode === "extras"
      ? tExtras("doneTitle")
      : t("doneTitle")
    : mode === "extras" && hasPreview
      ? tExtras("title")
      : t("title");

  return (
    <FormDialog open={open} onClose={handleClose} title={dialogTitle} size="lg">
      {!hasPreview && !result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t("intro")}</p>
          <p className="text-xs text-slate-500">{tExtras("hint")}</p>
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

      {hasPreview && !result ? (
        <div className="space-y-4">
          {fileName ? (
            <p className="text-xs text-slate-500">
              {t("fileLabel")}: {fileName}
              {mode === "extras" ? ` · ${tExtras("badge")}` : ""}
            </p>
          ) : null}
          {mode === "extras" && extrasPreview ? (
            <ExtrasPreview preview={extrasPreview} />
          ) : servicesPreview ? (
            <ServicesPreview preview={servicesPreview} />
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={importing}>
              {t("back")}
            </Button>
            <Button type="button" onClick={handleImport} disabled={!canImport || importing}>
              {importing
                ? mode === "extras"
                  ? tExtras("importing")
                  : t("importing")
                : mode === "extras"
                  ? tExtras("confirmImport")
                  : t("confirmImport")}
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          {result.mode === "services" ? (
            <p className="text-sm text-slate-700">
              {t("doneMessage", {
                created: result.data.created,
                updated: result.data.updated,
                categoriesCreated: result.data.categoriesCreated,
                categoriesUpdated: result.data.categoriesUpdated,
              })}
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              {tExtras("doneMessage", {
                extrasCreated: result.data.extrasCreated,
                extrasReused: result.data.extrasReused,
                linksCreated: result.data.linksCreated,
                linksUpdated: result.data.linksUpdated,
              })}
            </p>
          )}
          {result.data.errors.length > 0 ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                Erreurs ({result.data.errors.length})
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                {result.data.errors.slice(0, 20).map((message, idx) => (
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
