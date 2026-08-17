"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pauseCashSession, resumeCashSession } from "../../caisse-session-actions";
import { Button } from "@/components/ui/button";

export function PauseResumeButton({ paused }: { paused: boolean }) {
  const t = useTranslations("pos.session");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = paused ? await resumeCashSession() : await pauseCashSession();
    if (result.error) setError(result.error);
    setPending(false);
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleClick}
        className="h-9 shrink-0"
      >
        {pending ? "…" : paused ? t("resume") : t("pause")}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
