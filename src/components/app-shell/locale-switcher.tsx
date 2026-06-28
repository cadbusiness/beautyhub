"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [selected, setSelected] = useState<Locale>(activeLocale);

  useEffect(() => {
    setSelected(activeLocale);
  }, [activeLocale]);

  function pick(nextLocale: Locale) {
    if (!locales.includes(nextLocale) || nextLocale === selected || pending) return;

    setSelected(nextLocale);

    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5 transition-opacity",
        pending && "opacity-70",
        className,
      )}
      role="group"
      aria-label={t("language")}
      aria-busy={pending}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => pick(code)}
          className={cn(
            "flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1.5 text-[10px] font-medium transition-colors sm:h-8 sm:min-w-[2rem] sm:px-2 sm:text-xs",
            selected === code
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            pending && selected !== code && "pointer-events-none",
          )}
          aria-pressed={selected === code}
          aria-label={localeLabels[code]}
          title={localeLabels[code]}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
