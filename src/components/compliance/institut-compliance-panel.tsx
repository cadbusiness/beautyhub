"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  COMPLIANCE_CHECKLIST_KEYS,
  complianceProgress,
  type ComplianceChecklistKey,
  type TenantComplianceChecklist,
} from "@/lib/compliance/tenant-compliance";
import {
  saveDataRetentionDays,
  toggleComplianceChecklistItem,
} from "@/lib/compliance/actions";

export function InstitutCompliancePanel({
  checklist,
  retentionDays,
  tenantName,
}: {
  checklist: TenantComplianceChecklist;
  retentionDays: number | null;
  tenantName: string;
}) {
  const t = useTranslations("compliance.institut");
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [localRetention, setLocalRetention] = useState(
    retentionDays?.toString() ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progress = complianceProgress(localChecklist);
  const dpaUrl = `/api/legal/dpa?tenant=${encodeURIComponent(tenantName)}`;

  function toggleItem(key: ComplianceChecklistKey, checked: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await toggleComplianceChecklistItem(key, checked);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setLocalChecklist((prev) => {
        const next = { ...prev };
        if (checked) next[key] = new Date().toISOString();
        else delete next[key];
        return next;
      });
    });
  }

  function saveRetention() {
    setMessage(null);
    const raw = localRetention.trim();
    const days = raw === "" ? null : Number(raw);
    if (days !== null && (Number.isNaN(days) || days < 30 || days > 3650)) {
      setMessage(t("retentionInvalid"));
      return;
    }
    startTransition(async () => {
      const result = await saveDataRetentionDays(days);
      if (result.error) setMessage(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 shadow-none">
        <div>
          <h2 className="font-medium text-slate-900">{t("checklistTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("checklistHint")}</p>
          <p className="mt-2 text-xs text-slate-500">
            {t("progress", { done: progress.done, total: progress.total })}
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {COMPLIANCE_CHECKLIST_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                id={`compliance-${key}`}
                checked={Boolean(localChecklist[key])}
                disabled={pending}
                onChange={(e) => toggleItem(key, e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor={`compliance-${key}`} className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-slate-900">{t(`checklist.${key}.title`)}</span>
                <span className="mt-0.5 block text-slate-500">
                  {t(`checklist.${key}.hint`)}
                </span>
                {localChecklist[key] ? (
                  <span className="mt-1 block text-xs text-slate-400">
                    {t("checkedAt", {
                      date: new Date(localChecklist[key]!).toLocaleDateString(),
                    })}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4 p-5 shadow-none">
        <div>
          <h2 className="font-medium text-slate-900">{t("retentionTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("retentionHint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="retention-days" className="text-xs text-slate-500">
              {t("retentionLabel")}
            </label>
            <input
              id="retention-days"
              type="number"
              min={30}
              max={3650}
              placeholder={t("retentionPlaceholder")}
              value={localRetention}
              onChange={(e) => setLocalRetention(e.target.value)}
              className="mt-1 block h-9 w-40 rounded-md border border-slate-200 px-3 text-sm"
            />
          </div>
          <Button type="button" className="h-9" disabled={pending} onClick={saveRetention}>
            {t("retentionSave")}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-5 shadow-none">
        <h2 className="font-medium text-slate-900">{t("documentsTitle")}</h2>
        <p className="text-sm text-slate-500">{t("documentsHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={dpaUrl}>
            <Button type="button" variant="outline" className="h-9">
              {t("downloadDpa")}
            </Button>
          </Link>
          <Link href="/legal/confidentialite" target="_blank">
            <Button type="button" variant="outline" className="h-9">
              {t("platformPrivacy")}
            </Button>
          </Link>
          <Link href="/legal/sous-traitants" target="_blank">
            <Button type="button" variant="outline" className="h-9">
              {t("subprocessors")}
            </Button>
          </Link>
        </div>
      </Card>

      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
