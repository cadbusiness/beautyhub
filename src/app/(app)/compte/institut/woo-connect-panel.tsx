"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WooAutoConnect } from "./woo-auto-connect";
import { WooConnectionForm } from "./woo-connection-form";

export function WooConnectPanel({ defaultShopUrl }: { defaultShopUrl?: string }) {
  const t = useTranslations("institut.woo");
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="space-y-4">
      <WooAutoConnect defaultShopUrl={defaultShopUrl} />

      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {showManual ? t("hideManual") : t("showManual")}
        </button>
        {showManual ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">{t("manualHint")}</p>
            <WooConnectionForm defaultUrl={defaultShopUrl} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
