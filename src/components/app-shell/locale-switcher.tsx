"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

type LocaleSwitcherProps = {
  className?: string;
  variant?: "segmented" | "compact";
  name?: string;
  defaultValue?: Locale;
};

export function LocaleSwitcher({
  className,
  variant = "compact",
  name,
  defaultValue,
}: LocaleSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const t = useTranslations("shell");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Locale>(defaultValue ?? activeLocale);

  useEffect(() => {
    if (!name) setSelected(activeLocale);
  }, [activeLocale, name]);

  function pick(nextLocale: Locale) {
    if (!locales.includes(nextLocale) || nextLocale === selected) return;
    setSelected(nextLocale);

    if (name) return;

    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  if (variant === "segmented") {
    return (
      <div className={cn("space-y-2", className)}>
        {name ? (
          <input type="hidden" name={name} value={selected} readOnly />
        ) : null}
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
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
                "min-w-[3.25rem] rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                selected === code
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{localeLabels[selected]}</p>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex rounded-lg border border-slate-200 bg-white p-0.5", className)}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          onClick={() => pick(code)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            activeLocale === code
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          )}
          aria-pressed={activeLocale === code}
          aria-label={localeLabels[code]}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
