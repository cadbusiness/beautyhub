"use client";

import { useTranslations } from "next-intl";
import type { PosCartDto } from "@/lib/institut/pos-cart-types";
import type { PosCartLocalState } from "./use-pos-carts";

function firstName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function clientTitle(cart: PosCartDto) {
  const fromClient = firstName(cart.clientName);
  if (fromClient) return fromClient;
  const label = cart.label.trim();
  if (label && !label.toLowerCase().startsWith("panier")) {
    return firstName(label);
  }
  return "";
}

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

  function ownerLine(cart: PosCartDto) {
    if (cart.lockedByOther) {
      const who = firstName(cart.lockedByName);
      return who ? t("onItNamed", { name: who }) : t("onItUnknown");
    }
    const staff = firstName(cart.staffName);
    if (staff) return staff;
    return t("free");
  }

  async function confirmTakeover(cart: PosCartDto) {
    const who = firstName(cart.lockedByName);
    const title = who ? t("takeoverTitle", { name: who }) : t("locked");
    return window.confirm(`${title}\n${t("takeoverBody")}`);
  }

  async function handleSelect(cart: PosCartDto) {
    if (cart.id === activeCartId) return;
    if (cart.lockedByOther) {
      const ok = await confirmTakeover(cart);
      if (!ok) return;
      const next = await onSelect(cart.id, true);
      if (next) onApplied(next);
      return;
    }
    try {
      const next = await onSelect(cart.id);
      if (next) onApplied(next);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "locked") {
        const ok = await confirmTakeover(cart);
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
        const ok = await confirmTakeover(cart);
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
      <div className="flex flex-wrap items-center gap-2">
        {carts.map((cart) => {
          const selected = cart.id === activeCartId;
          const occupied = cart.lockedByOther;
          const title = clientTitle(cart) || t("noClient");
          return (
            <button
              key={cart.id}
              type="button"
              onClick={() => void handleSelect(cart)}
              className={`min-w-[6.75rem] rounded-xl border px-3 py-2 text-left ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : occupied
                    ? "border-amber-300 bg-amber-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{title}</span>
                {selected && !occupied ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-[11px] opacity-80 hover:opacity-100"
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
              </span>
              <span
                className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-medium ${
                  selected
                    ? "text-white/75"
                    : occupied
                      ? "text-amber-800"
                      : "text-slate-500"
                }`}
              >
                {occupied ? (
                  <span className="size-1.5 rounded-full bg-amber-600" aria-hidden />
                ) : null}
                <span>
                  {ownerLine(cart)}
                  {cart.itemCount > 0 ? `  ·  ${cart.itemCount}` : ""}
                </span>
              </span>
            </button>
          );
        })}
        {carts.length < 8 ? (
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex h-[52px] w-11 items-center justify-center rounded-xl border border-slate-200 text-lg font-medium text-slate-700 hover:border-slate-300"
            aria-label={t("add")}
          >
            +
          </button>
        ) : null}
      </div>
      {active?.lockedByOther ? (
        <p className="text-xs font-medium text-amber-800">
          {active.lockedByName
            ? t("lockedBy", { name: firstName(active.lockedByName) })
            : t("locked")}
        </p>
      ) : null}
    </div>
  );
}
