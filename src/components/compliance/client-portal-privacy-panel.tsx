"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requestClientErasure } from "@/app/(public)/client/compliance-actions";

export function ClientPortalPrivacyPanel() {
  const t = useTranslations("compliance.portal");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleExport() {
    window.location.href = "/api/client/me/export";
  }

  function handleDeleteRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestClientErasure();
      if (result?.error) setError(result.error);
      else window.location.href = "/client/login";
    });
  }

  return (
    <Card className="mt-6 space-y-4 border-slate-200 p-5 shadow-none">
      <div>
        <h2 className="font-medium text-slate-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={handleExport}>
          {t("export")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 text-red-600"
          disabled={pending}
          onClick={handleDeleteRequest}
        >
          {t("erase")}
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        {t("legalNote")}{" "}
        <Link href="/legal/confidentialite" className="underline hover:text-slate-600">
          {t("privacyLink")}
        </Link>
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
