"use client";

import { useTranslations } from "next-intl";
import type { PosCartDto } from "@/lib/institut/pos-cart-types";
import type { PosCartLocalState } from "./use-pos-carts";

export function PosCartSwitcher({
  carts,
  activeCartId,
  onSelect,
  onAdd,
  onAbandon,
  onApplied,
}: {
  carts: PosCartDto[];
  activeCartId: string | null;
  onSelect: (id: string, force?: boolean) => Promise<PosCartLocalState | null>;
  onAdd: () => Promise<PosCartLocalState | null>;
  onAbandon: (id: string, force?: boolean) => Promise<PosCartLocalState | null>;
  onApplied: (next: PosCartLocalState) => void;
}) {
  const t = useTranslations("pos.terminal.cart");
  const active = carts.find((c) => c.id === activeCartId) ?? null;

  async function handleSelect(cart: PosCartDto) {
    if (cart.id === activeCartId) return;
    try {
      const next = await onSelect(cart.id);
      if (next) onApplied(next);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "locked") {
        const ok = window.confirm(
          `${e instanceof Error ? e.message : t("locked")}\n${t("takeover")}`,
        );
        if (!ok) return;
        const next = await onSelect(cart.id, true);
        if (next) onApplied(next);
        return;
      }
      window.alert(e instanceof Error ? e.message : t("saveFailed"));
    }
  }

  async function handleAdd() {
    try {
      const next = await onAdd();
      if (next) onApplied(next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t("maxReached"));
    }
  }

  async function handleAbandon(cart: PosCartDto) {
    try {
      const next = await onAbandon(cart.id);
      if (next) onApplied(next);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "locked") {
        const ok = window.confirm(
          `${e instanceof Error ? e.message : t("locked")}\n${t("takeover")}`,
        );
        if (!ok) return;
        const next = await onAbandon(cart.id, true);
        if (next) onApplied(next);
        return;
      }
      window.alert(e instanceof Error ? e.message : t("saveFailed"));
    }
  }

  if (carts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {carts.map((cart) => {
          const selected = cart.id === activeCartId;
          const label =
            cart.itemCount > 0
              ? `${cart.label} · ${cart.itemCount} art.`
              : cart.label;
          return (
            <button
              key={cart.id}
              type="button"
              onClick={() => void handleSelect(cart)}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {cart.lockedByOther ? <span aria-hidden>🔒</span> : null}
              <span>{label}</span>
              {selected ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-0.5 text-[11px] opacity-80 hover:opacity-100"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void handleAbandon(cart);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.stopPropagation();
                      void handleAbandon(cart);
                    }
                  }}
                  aria-label={t("abandon")}
                >
                  ×
                </span>
              ) : null}
            </button>
          );
        })}
        {carts.length < 8 ? (
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-300"
            aria-label={t("add")}
          >
            +
          </button>
        ) : null}
      </div>
      {active?.lockedByOther ? (
        <p className="text-xs font-medium text-amber-800">
          {active.lockedByName
            ? t("lockedBy", { name: active.lockedByName })
            : t("locked")}
        </p>
      ) : null}
    </div>
  );
}
