"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LocaleSwitcher({ className }: { className?: string }) {
  const activeLocale = useLocale() as Locale;
  const t = useTranslations("shell");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(nextLocale: Locale) {
    if (!locales.includes(nextLocale) || nextLocale === activeLocale) return;

    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          onClick={() => pick(code)}
          className={cn(
            "flex h-8 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
            activeLocale === code
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          )}
          aria-pressed={activeLocale === code}
          aria-label={localeLabels[code]}
          title={localeLabels[code]}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
