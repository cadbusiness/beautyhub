"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "bh_cookie_consent";

export function CookieBanner() {
  const t = useTranslations("legal.cookies");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (!stored) setVisible(true);
  }, []);

  function accept(value: "essential" | "all") {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg sm:p-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{t("title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t("description")}{" "}
            <Link href="/legal/confidentialite" className="underline hover:text-slate-900">
              {t("learnMore")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => accept("essential")}
          >
            {t("essentialOnly")}
          </Button>
          <Button type="button" className="h-9" onClick={() => accept("all")}>
            {t("acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
