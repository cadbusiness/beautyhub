"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { anonymizeClientAction } from "@/lib/compliance/actions";

export function ClientPrivacyPanel({
  clientId,
  canAnonymize,
  isAnonymized,
}: {
  clientId: string;
  canAnonymize: boolean;
  isAnonymized: boolean;
}) {
  const t = useTranslations("compliance.clientPanel");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleExport() {
    window.location.href = `/api/institut/clients/${clientId}/export`;
  }

  function handleAnonymize() {
    setError(null);
    startTransition(async () => {
      const result = await anonymizeClientAction(clientId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      window.location.reload();
    });
  }

  if (isAnonymized) {
    return (
      <p className="text-sm text-slate-500">{t("alreadyAnonymized")}</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("description")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={handleExport}>
          {t("export")}
        </Button>
        {canAnonymize ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 text-red-600"
            onClick={() => setConfirmOpen(true)}
          >
            {t("anonymize")}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <FormDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("confirmTitle")}
        size="md"
      >
        <div className="space-y-4 px-4 py-4 lg:px-6">
          <p className="text-sm text-slate-600">{t("confirmHint")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={pending}
              onClick={handleAnonymize}
            >
              {t("confirmAction")}
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
