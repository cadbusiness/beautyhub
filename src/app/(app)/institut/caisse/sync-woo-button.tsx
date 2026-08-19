"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function SyncWooButton() {
  const t = useTranslations("institut.pos");
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState<{ products: number; shops: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setOk(null);
    setError(null);
    try {
      const res = await fetch("/api/institut/caisse/sync-woo", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        syncedCount?: number;
        shopsCount?: number;
      };
      if (!res.ok || data.error || !data.ok) {
        setError(data.error || t("syncWooError"));
        return;
      }
      setOk({
        products: data.syncedCount ?? 0,
        shops: data.shopsCount ?? 0,
      });
    } catch {
      setError(t("syncWooError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Button variant="outline" type="submit" className="h-9" disabled={pending}>
        {pending ? t("syncWooPending") : t("syncWoo")}
      </Button>
      {ok ? (
        <span className="text-xs text-slate-500">
          {t("syncWooDone", {
            products: ok.products,
            shops: ok.shops,
          })}
        </span>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );
}
