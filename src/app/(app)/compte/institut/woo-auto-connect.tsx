"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startWooPairing, type PairingResult } from "@/app/(app)/institut/woo-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initial: PairingResult = {};

export function WooAutoConnect({ defaultShopUrl }: { defaultShopUrl?: string }) {
  const t = useTranslations("institut.woo.auto");
  const router = useRouter();
  const [state, action, pending] = useActionState(startWooPairing, initial);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!state.pairingUrl || !state.shopUrl) return;

    setPolling(true);
    const shopUrl = state.shopUrl;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/connectors/woocommerce/pair/status?shopUrl=${encodeURIComponent(shopUrl)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { connected?: boolean };
        if (data.connected) {
          clearInterval(interval);
          setPolling(false);
          router.refresh();
        }
      } catch {
        /* retry */
      }
    }, 2000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setPolling(false);
    };
  }, [state.pairingUrl, state.shopUrl, router]);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 lg:px-5">
      <div>
        <p className="text-sm font-medium text-slate-900">{t("title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t("description")}</p>
      </div>

      <form action={action} className="space-y-4">
        <Field label={t("shopUrl")} htmlFor="shop_url">
          <Input
            id="shop_url"
            name="shop_url"
            type="url"
            required
            defaultValue={defaultShopUrl}
            placeholder={t("shopUrlPlaceholder")}
          />
        </Field>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <Button type="submit" disabled={pending || polling}>
          {pending ? t("generating") : polling ? t("waiting") : t("connect")}
        </Button>
      </form>

      {state.pairingUrl ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-600">{t("linkHint")}</p>
          <a
            href={state.pairingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("openLink")}
          </a>
          <p className="break-all font-mono text-xs text-slate-500">{state.pairingUrl}</p>
          {polling ? (
            <p className="text-xs text-blue-700">{t("polling")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
