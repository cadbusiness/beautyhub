"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { generateXReport } from "../../caisse-session-actions";
import { Button } from "@/components/ui/button";

export function XReportButton() {
  const t = useTranslations("pos.session");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await generateXReport();
    if (result.error) setError(result.error);
    else if (result.message) setMessage(result.message);
    setPending(false);
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" disabled={pending} onClick={handleClick}>
        {pending ? "…" : t("generateX")}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {message ? <p className="text-xs text-green-600">{message}</p> : null}
    </div>
  );
}
