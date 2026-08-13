"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function PrestationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("institut.services");

  useEffect(() => {
    console.error("[prestations] boundary caught", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-red-600">{t("loadError")}</p>
      {error?.digest ? (
        <p className="text-xs text-slate-500 font-mono">digest: {error.digest}</p>
      ) : null}
      <Button type="button" variant="outline" className="h-9" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
