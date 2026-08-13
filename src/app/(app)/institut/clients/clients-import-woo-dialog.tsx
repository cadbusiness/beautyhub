"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";

type WooImportProgress = {
  kind: "start" | "progress" | "done";
  total?: number;
  processed?: number;
  created?: number;
  matched?: {
    external: number;
    phone: number;
    email: number;
    name: number;
  };
  errors?: string[];
  quotaBlocked?: boolean;
  page?: number;
  pagesProcessed?: number;
};

const emptyProgress = {
  total: 0,
  processed: 0,
  created: 0,
  matched: { external: 0, phone: 0, email: 0, name: 0 },
  errors: [] as string[],
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
  const [total, setTotal] = useState<number | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(emptyProgress);
  const [done, setDone] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    setTotal(null);
    setStoreUrl(null);
    setImporting(false);
    setProgress({ ...emptyProgress });
    setDone(false);
    setRunError(null);
    try {
      const res = await fetch("/api/institut/clients/import-woo", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        total?: number;
        storeUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setStatusError(data.error === "no_woo_connection" ? t("noConnection") : t("statusError"));
        return;
      }
      setTotal(typeof data.total === "number" ? data.total : 0);
      setStoreUrl(typeof data.storeUrl === "string" ? data.storeUrl : null);
    } catch (err) {
      console.error("[clients-import-woo]", err);
      setStatusError(t("statusError"));
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

  async function runImport() {
    setImporting(true);
    setDone(false);
    setRunError(null);
    setProgress({ ...emptyProgress, total: total ?? 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/institut/clients/import-woo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRunError(data.error ?? `HTTP ${res.status}`);
        setImporting(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");
          if (!line) continue;
          try {
            const evt = JSON.parse(line) as WooImportProgress;
            if (evt.kind === "start" && typeof evt.total === "number") {
              setProgress((prev) => ({ ...prev, total: evt.total ?? prev.total }));
            } else if (evt.kind === "progress" || evt.kind === "done") {
              setProgress((prev) => ({
                total: prev.total,
                processed: evt.processed ?? prev.processed,
                created: evt.created ?? prev.created,
                matched: evt.matched ?? prev.matched,
                errors: evt.errors ?? prev.errors,
              }));
              if (evt.quotaBlocked) {
                setRunError(t("quotaBlocked"));
              }
              if (evt.kind === "done") {
                setDone(true);
              }
            }
          } catch (parseErr) {
            console.warn("[clients-import-woo] parse error", parseErr, line);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setRunError(t("aborted"));
      } else {
        console.error("[clients-import-woo]", err);
        setRunError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setImporting(false);
      abortRef.current = null;
    }
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
            <StatLine label={t("stats.total")} value={total ?? 0} />
          </div>
          <p className="text-xs text-slate-500">{t("hint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void runImport()}
              disabled={!total || total === 0}
            >
              {t("confirm")}
            </Button>
          </div>
        </div>
      ) : null}

      {importing || done ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="font-medium">{t("progressTitle")}</span>
              <span className="tabular-nums">
                {progress.processed} / {progress.total} · {percent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
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
              <Button
                type="button"
                onClick={() => {
                  handleClose();
                  router.refresh();
                }}
              >
                {tCommon("close")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </FormDialog>
  );
}
