"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";

const PAGE_SIZE = 100;

type PageResponse = {
  page: number;
  batchSize: number;
  hasMore: boolean;
  created: number;
  matched: { external: number; phone: number; email: number; name: number };
  errors: string[];
  quotaBlocked?: boolean;
};

type Progress = {
  total: number | null;
  processed: number;
  created: number;
  matched: { external: number; phone: number; email: number; name: number };
  errors: string[];
};

const emptyProgress: Progress = {
  total: null,
  processed: 0,
  created: 0,
  matched: { external: 0, phone: 0, email: 0, name: 0 },
  errors: [],
};

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function ClientsImportWooDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("institut.clients.importWoo");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusWarning, setStatusWarning] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [done, setDone] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalKnown = progress.total !== null && progress.total > 0;
  const percent =
    totalKnown && progress.total
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    setStatusWarning(null);
    setTotal(null);
    setStoreUrl(null);
    setImporting(false);
    setProgress({ ...emptyProgress });
    setDone(false);
    setRunError(null);
    setCurrentPage(0);
    try {
      const res = await fetch("/api/institut/clients/import-woo", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        total?: number | null;
        storeUrl?: string;
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        if (data.error === "no_woo_connection") {
          setStatusError(t("noConnection"));
        } else {
          setStatusError(
            data.error ? `${t("statusError")} — ${data.error}` : t("statusError"),
          );
        }
        return;
      }
      setTotal(typeof data.total === "number" ? data.total : null);
      setStoreUrl(typeof data.storeUrl === "string" ? data.storeUrl : null);
      if (data.warning) setStatusWarning(data.warning);
    } catch (err) {
      console.error("[clients-import-woo]", err);
      setStatusError(
        err instanceof Error ? `${t("statusError")} — ${err.message}` : t("statusError"),
      );
    } finally {
      setStatusLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchStatus]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  function handleClose() {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }

  async function fetchPage(
    page: number,
    signal: AbortSignal,
  ): Promise<PageResponse | { error: string; hasMore: false }> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort);
    try {
      const res = await fetch("/api/institut/clients/import-woo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as PageResponse & { error?: string };
      if (!res.ok) {
        return {
          error:
            (data.errors && data.errors.length > 0 ? data.errors[0] : data.error) ??
            `HTTP ${res.status}`,
          hasMore: false,
        };
      }
      return data;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  async function runImport() {
    setImporting(true);
    setDone(false);
    setRunError(null);
    setProgress({ ...emptyProgress, total });

    const controller = new AbortController();
    abortRef.current = controller;

    const aggregate: Progress = {
      total,
      processed: 0,
      created: 0,
      matched: { external: 0, phone: 0, email: 0, name: 0 },
      errors: [],
    };

    let page = 1;
    let hasMore = true;
    let quotaBlocked = false;
    let hardStop = false;

    while (hasMore && !controller.signal.aborted && !quotaBlocked && !hardStop) {
      setCurrentPage(page);

      let response: PageResponse | { error: string; hasMore: false } | null = null;
      let attempt = 0;
      const maxRetries = 2;
      while (attempt <= maxRetries) {
        if (controller.signal.aborted) break;
        try {
          response = await fetchPage(page, controller.signal);
          break;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") break;
          attempt += 1;
          if (attempt > maxRetries) {
            aggregate.errors.push(
              `page ${page}: ${err instanceof Error ? err.message : String(err)}`,
            );
            hardStop = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }

      if (!response || controller.signal.aborted) break;

      if ("error" in response) {
        aggregate.errors.push(`page ${page}: ${response.error}`);
        hardStop = true;
        break;
      }

      aggregate.processed += response.batchSize;
      aggregate.created += response.created;
      aggregate.matched.external += response.matched.external;
      aggregate.matched.phone += response.matched.phone;
      aggregate.matched.email += response.matched.email;
      aggregate.matched.name += response.matched.name;
      if (response.errors.length > 0) aggregate.errors.push(...response.errors);
      quotaBlocked = Boolean(response.quotaBlocked);

      // Bump total dynamically once we detect the end
      if (!hasMore || response.batchSize < PAGE_SIZE) {
        // Nothing to do — hasMore updated below
      }
      if (total === null || aggregate.processed > (total ?? 0)) {
        aggregate.total = aggregate.processed + (response.hasMore ? PAGE_SIZE : 0);
      }
      setProgress({ ...aggregate });

      hasMore = response.hasMore;
      if (quotaBlocked) {
        setRunError(t("quotaBlocked"));
        break;
      }
      page += 1;
    }

    // Finalize
    aggregate.total = total ?? aggregate.processed;
    setProgress({ ...aggregate });

    if (controller.signal.aborted) {
      setRunError(t("aborted"));
    }

    setImporting(false);
    setDone(true);
    abortRef.current = null;
  }

  function handleAbort() {
    abortRef.current?.abort();
  }

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={done ? t("doneTitle") : t("title")}
      size="lg"
    >
      {statusLoading ? (
        <p className="text-sm text-slate-500">{t("loadingStatus")}</p>
      ) : null}

      {statusError ? (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{statusError}</p>
          <Button type="button" variant="outline" onClick={handleClose}>
            {tCommon("close")}
          </Button>
        </div>
      ) : null}

      {!statusLoading && !statusError && !importing && !done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t("intro")}</p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <StatLine label={t("stats.storeUrl")} value={storeUrl ?? tCommon("dash")} />
            <StatLine
              label={t("stats.total")}
              value={total === null ? tCommon("dash") : total}
            />
          </div>
          {statusWarning ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {statusWarning}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">{t("hint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={() => void runImport()}>
              {t("confirm")}
            </Button>
          </div>
        </div>
      ) : null}

      {importing || done ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="font-medium">
                {t("progressTitle")}
                {importing && currentPage > 0 ? ` · page ${currentPage}` : ""}
              </span>
              <span className="tabular-nums">
                {progress.processed}
                {totalKnown ? ` / ${progress.total}` : ""}
                {percent !== null ? ` · ${percent}%` : ""}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              {totalKnown && percent !== null ? (
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-400" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t("stats.created")}</p>
              <p className="text-lg font-medium tabular-nums text-slate-900">{progress.created}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.matchedPhone")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.matched.phone}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.matchedEmail")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.matched.email}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.matchedName")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.matched.name}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.matchedExternal")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.matched.external}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t("stats.errors")}
              </p>
              <p className="text-lg font-medium tabular-nums text-slate-900">
                {progress.errors.length}
              </p>
            </div>
          </div>

          {runError ? <p className="text-sm text-red-600">{runError}</p> : null}

          {progress.errors.length > 0 ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {t("stats.errors")}: {progress.errors.length}
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {progress.errors.slice(0, 20).map((message, idx) => (
                  <li key={idx} className="truncate">
                    · {message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {importing ? (
              <Button type="button" variant="outline" onClick={handleAbort}>
                {tCommon("cancel")}
              </Button>
            ) : (
              <>
                {progress.errors.length > 0 || runError ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runImport()}
                  >
                    {t("retry")}
                  </Button>
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
              </>
            )}
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}
