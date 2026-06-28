"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { cn } from "@/lib/utils";

export function UserMenu({
  email,
  roleText,
  displayName,
  initial,
}: {
  email: string | null;
  roleText: string;
  displayName: string;
  initial: string;
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-medium text-slate-900">
            {displayName}
          </span>
          <span className="block max-w-[9rem] truncate text-xs text-slate-500">{roleText}</span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
            {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
            <p className="mt-1 text-xs text-slate-400">{roleText}</p>
          </div>

          <div className="px-2 py-2">
            <Link
              href="/compte"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              )}
              role="menuitem"
            >
              {t("myAccount")}
            </Link>
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("language")}
            </p>
            <LocaleSwitcher variant="segmented" />
          </div>

          <div className="border-t border-slate-100 p-2">
            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                className="h-9 w-full justify-center text-sm"
                onClick={() => setOpen(false)}
              >
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
