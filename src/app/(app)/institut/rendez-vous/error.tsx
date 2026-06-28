"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function RendezVousError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("appointments.calendar");

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-red-600">{t("loadError")}</p>
      <Button type="button" variant="outline" className="h-9" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
