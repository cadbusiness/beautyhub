"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/input";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("shell");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(nextLocale: string) {
    if (!locales.includes(nextLocale as Locale)) return;
    startTransition(async () => {
      await setLocale(nextLocale as Locale);
      router.refresh();
    });
  }

  return (
    <label className={className}>
      <span className="sr-only">{t("language")}</span>
      <Select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="h-9 w-[7.5rem] text-sm"
        aria-label={t("language")}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </Select>
    </label>
  );
}
