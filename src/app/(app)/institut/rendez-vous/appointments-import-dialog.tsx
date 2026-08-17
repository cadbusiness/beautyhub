"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input } from "@/components/ui/input";
import {
  filterUpcomingRows,
  isBooklyAppointmentsCsv,
  isBooklyAppointmentsJson,
  parseBooklyAppointmentsCsv,
  parseBooklyAppointmentsJson,
  previewBooklyAppointmentsImport,
  type BooklyAppointmentCatalog,
  type BooklyAppointmentCsvRow,
  type BooklyAppointmentImportPreview,
  type BooklyAppointmentImportResult,
} from "@/lib/institut/appointment-import/bookly-csv";

const BATCH_SIZE = 40;

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
    </div>
  );
}

type SyncStatus = {
  enabled: boolean;
  url: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

function SyncPanel({
  status,
  loading,
  busy,
  copied,
  onEnable,
  onDisable,
  onCopy,
}: {
  status: SyncStatus | null;
  loading: boolean;
  busy: boolean;
  copied: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations("appointments.import.sync");
  if (loading && !status) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }
  return (
    <div className="space-y-3 border-b border-slate-200 pb-4">
      <p className="text-sm text-slate-600">{t("intro")}</p>
      {status?.enabled && status.url ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">{t("enabled")}</p>
          <Field label={t("urlLabel")} htmlFor="bookly-sync-url">
            <div className="flex gap-2">
              <Input id="bookly-sync-url" readOnly value={status.url} className="font-mono text-xs" />
              <Button type="button" variant="outline" className="h-10 shrink-0" onClick={onCopy}>
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </Field>
          <p className="text-xs text-slate-500">{t("pasteHint")}</p>
          {status.lastSyncAt ? (
            <p className="text-xs text-slate-600">
              {t("lastSync")}: {new Date(status.lastSyncAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-xs text-slate-500">{t("waitingFirst")}</p>
          )}
          {status.lastError ? <p className="text-xs text-amber-800">{status.lastError}</p> : null}
          <Button type="button" variant="outline" className="h-9" onClick={onDisable} disabled={busy}>
            {t("disable")}
          </Button>
        </>
      ) : (
        <Button type="button" onClick={onEnable} disabled={busy} className="h-9">
          {busy ? t("enabling") : t("enable")}
        </Button>
      )}
    </div>
  );
}

const emptyCatalog: BooklyAppointmentCatalog = {
  services: [],
  staff: [],
  extras: [],
  existingAppointments: [],
};

export function AppointmentsImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointments.import");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BooklyAppointmentCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<BooklyAppointmentImportPreview | null>(null);
  const [catalog, setCatalog] = useState<BooklyAppointmentCatalog>(emptyCatalog);
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BooklyAppointmentImportResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSyncLoading(true);
    void fetch("/api/institut/appointments/bookly-sync", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        setSyncStatus((await res.json()) as SyncStatus);
      })
      .catch(() => null)
      .finally(() => setSyncLoading(false));
  }, [open]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName("");
    setPreview(null);
    setError(null);
    setResult(null);
    setImporting(false);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  function applyPreview(nextRows: BooklyAppointmentCsvRow[], nextCatalog: BooklyAppointmentCatalog, onlyUpcoming: boolean) {
    setPreview(previewBooklyAppointmentsImport(nextRows, nextCatalog, onlyUpcoming));
  }

  async function readFile(file: File) {
    setAnalyzing(true);
    setError(null);
    setPreview(null);
    setResult(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const json = isBooklyAppointmentsJson(text);
      const csv = isBooklyAppointmentsCsv(text);
      if (!json && !csv) {
        setError(t("errors.invalidFile"));
        return;
      }

      const parsed = json ? parseBooklyAppointmentsJson(text) : parseBooklyAppointmentsCsv(text);
      if (parsed.errors.includes("missing_columns") || parsed.errors.includes("invalid_json")) {
        setError(t("errors.missingColumns"));
        return;
      }
      if (parsed.rows.length === 0) {
        setError(t("errors.emptyFile"));
        return;
      }

      let nextCatalog = emptyCatalog;
      try {
        const res = await fetch("/api/institut/appointments/import-status", { credentials: "include" });
        if (res.ok) nextCatalog = (await res.json()) as BooklyAppointmentCatalog;
      } catch {
        // Preview works with empty catalog.
      }

      setCatalog(nextCatalog);
      setRows(parsed.rows);
      applyPreview(parsed.rows, nextCatalog, upcomingOnly);
    } catch (err) {
      console.error("[appointments-import-dialog]", err);
      setError(t("errors.invalidFile"));
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleUpcoming(checked: boolean) {
    setUpcomingOnly(checked);
    if (rows.length) applyPreview(rows, catalog, checked);
  }

  async function syncAction(action: "enable" | "disable") {
    setSyncBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/institut/appointments/bookly-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? t("sync.failed"));
        return;
      }
      setSyncStatus((await res.json()) as SyncStatus);
    } catch {
      setError(t("sync.failed"));
    } finally {
      setSyncBusy(false);
    }
  }

  async function copySyncUrl() {
    if (!syncStatus?.url) return;
    try {
      await navigator.clipboard.writeText(syncStatus.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    const acc: BooklyAppointmentImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      cancelled: 0,
      clientsCreated: 0,
      unmatchedStaff: 0,
      missingService: 0,
      errors: [],
    };

    try {
      const toSend = filterUpcomingRows(rows, upcomingOnly);
      setProgress({ processed: 0, total: toSend.length });
      for (let offset = 0; offset < toSend.length; offset += BATCH_SIZE) {
        const batch = toSend.slice(offset, offset + BATCH_SIZE);
        const res = await fetch("/api/institut/appointments/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch, upcomingOnly: false }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setError(payload.error ?? t("errors.importFailed"));
          return;
        }
        const data = (await res.json()) as BooklyAppointmentImportResult;
        acc.created += data.created;
        acc.updated += data.updated;
        acc.skipped += data.skipped;
        acc.cancelled += data.cancelled ?? 0;
        acc.clientsCreated += data.clientsCreated;
        acc.unmatchedStaff += data.unmatchedStaff;
        acc.missingService += data.missingService;
        acc.errors.push(...data.errors);
        setProgress({ processed: Math.min(toSend.length, offset + batch.length), total: toSend.length });
      }
      setResult(acc);
    } catch (err) {
      console.error("[appointments-import-dialog]", err);
      setError(t("errors.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  const canImport = preview != null && preview.toCreate + preview.toUpdate > 0;
  const dialogTitle = result ? t("doneTitle") : t("title");

  return (
    <FormDialog open={open} onClose={handleClose} title={dialogTitle} size="lg">
      {!preview && !result ? (
        <div className="space-y-4">
          <SyncPanel
            status={syncStatus}
            loading={syncLoading}
            busy={syncBusy}
            copied={copied}
            onEnable={() => void syncAction("enable")}
            onDisable={() => void syncAction("disable")}
            onCopy={() => void copySyncUrl()}
          />
          <p className="text-sm font-medium text-slate-800">{t("csvTitle")}</p>
          <p className="text-sm text-slate-600">{t("intro")}</p>
          <p className="text-xs text-slate-500">{t("hint")}</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-slate-400">
            <span className="text-sm font-medium text-slate-800">{t("chooseFile")}</span>
            <span className="text-xs text-slate-500">{t("fileHint")}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
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
          <p className="text-sm text-slate-600">{t("previewIntro")}</p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <StatLine label={t("stats.total")} value={preview.totalRows} />
            <StatLine label={t("stats.create")} value={preview.toCreate} />
            <StatLine label={t("stats.update")} value={preview.toUpdate} />
            <StatLine label={t("stats.missingService")} value={preview.missingService} />
            <StatLine label={t("stats.unmatchedStaff")} value={preview.unmatchedStaff} />
            <StatLine label={t("stats.skip")} value={preview.skipped} />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={upcomingOnly}
              onChange={(e) => toggleUpcoming(e.target.checked)}
              disabled={importing}
            />
            <span>{t("upcomingOnly")}</span>
          </label>
          {preview.missingServiceTitles.length > 0 ? (
            <p className="text-xs text-amber-800">
              {t("missingServiceHint")}: {preview.missingServiceTitles.join(" · ")}
            </p>
          ) : null}
          {preview.unmatchedStaffNames.length > 0 ? (
            <p className="text-xs text-amber-800">
              {t("unmatchedStaffHint")}: {preview.unmatchedStaffNames.join(" · ")}
            </p>
          ) : null}
          {preview.samples.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("samples")}
              </p>
              <ul className="space-y-1 text-sm text-slate-700">
                {preview.samples.map((row) => (
                  <li key={`${row.startsAt}-${row.clientName}`} className="truncate">
                    {row.startsAt.slice(0, 16).replace("T", " ")} · {row.serviceTitle} · {row.clientName}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {progress ? (
            <p className="text-sm text-slate-500">
              {t("progress", { processed: progress.processed, total: progress.total })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={importing}>
              {t("back")}
            </Button>
            <Button type="button" onClick={() => void handleImport()} disabled={!canImport || importing}>
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
              clientsCreated: result.clientsCreated,
              unmatchedStaff: result.unmatchedStaff,
              missingService: result.missingService,
            })}
          </p>
          {result.errors.length > 0 ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {t("errorsCount", { count: result.errors.length })}
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {result.errors.slice(0, 30).map((message, idx) => (
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
