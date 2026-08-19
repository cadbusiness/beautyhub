"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PosCartDto, PosCartWritePayload } from "@/lib/institut/pos-cart-types";

export type PosCartLocalState = {
  cart: Record<string, number>;
  priceOverrides: Record<string, number>;
  clientId: string;
  staffId: string;
  lineStaff: Record<string, string>;
  appointmentId: string;
  notes: string;
  cartDiscountKind: "percent" | "fixed";
  cartDiscountValue: string;
  cartDiscountReason: string;
  cartDiscountCents: number;
};

type ApiError = { error?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    const err = new Error(data.message ?? data.error ?? "pos_cart_failed");
    (err as Error & { code?: string }).code = data.error;
    throw err;
  }
  return data;
}

export function applyPosCartToLocal(cart: PosCartDto): PosCartLocalState {
  return {
    cart: cart.lines ?? {},
    priceOverrides: cart.priceOverrides ?? {},
    clientId: cart.clientId ?? "",
    staffId: cart.staffId ?? "",
    lineStaff: cart.lineStaff ?? {},
    appointmentId: cart.appointmentId ?? "",
    notes: cart.notes ?? "",
    cartDiscountKind: cart.discountKind === "fixed" ? "fixed" : "percent",
    cartDiscountValue:
      cart.discountValue != null && cart.discountValue > 0
        ? String(cart.discountValue)
        : "",
    cartDiscountReason: cart.discountReason ?? "",
    cartDiscountCents: cart.cartDiscountCents ?? 0,
  };
}

export function usePosCarts(local: PosCartLocalState) {
  const [carts, setCarts] = useState<PosCartDto[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skipSave = useRef(false);
  const localRef = useRef(local);
  localRef.current = local;
  const activeCartIdRef = useRef(activeCartId);
  activeCartIdRef.current = activeCartId;

  const active = carts.find((c) => c.id === activeCartId) ?? null;

  const writePayload = useCallback((): PosCartWritePayload => {
    const cur = localRef.current;
    const n = Number.parseFloat(cur.cartDiscountValue.replace(",", "."));
    return {
      lines: cur.cart,
      priceOverrides: cur.priceOverrides,
      clientId: cur.clientId || null,
      staffId: cur.staffId || null,
      lineStaff: cur.lineStaff,
      appointmentId: cur.appointmentId || null,
      notes: cur.notes || null,
      discountKind: cur.cartDiscountKind,
      discountValue: Number.isFinite(n) && n > 0 ? n : null,
      discountReason: cur.cartDiscountReason || null,
      cartDiscountCents: cur.cartDiscountCents,
    };
  }, []);

  const applyRemote = useCallback((nextCarts: PosCartDto[], nextActive: PosCartDto) => {
    skipSave.current = true;
    setCarts(nextCarts);
    setActiveCartId(nextActive.id);
    return applyPosCartToLocal(nextActive);
  }, []);

  const ensure = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parseJson<{ carts: PosCartDto[]; active: PosCartDto }>(
        await fetch("/api/institut/pos-carts?ensure=1"),
      );
      return applyRemote(data.carts, data.active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "pos_cart_failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyRemote]);

  const flushSave = useCallback(
    async (force = false) => {
      const id = activeCartIdRef.current;
      if (!id || skipSave.current) return;
      if (active?.lockedByOther && !force) return;
      try {
        const data = await parseJson<{ cart: PosCartDto }>(
          await fetch(`/api/institut/pos-carts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...writePayload(), force }),
          }),
        );
        setCarts((prev) =>
          prev.map((c) => (c.id === data.cart.id ? data.cart : c)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "pos_cart_failed");
        throw e;
      }
    },
    [active?.lockedByOther, writePayload],
  );

  const createEmpty = useCallback(async () => {
    await flushSave().catch(() => undefined);
    const cur = localRef.current;
    const empty = Object.values(cur.cart).every((qty) => qty <= 0);
    if (empty && (active?.itemCount ?? 0) === 0) return null;
    const data = await parseJson<{ cart: PosCartDto }>(
      await fetch("/api/institut/pos-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const list = await parseJson<{ carts: PosCartDto[] }>(
      await fetch("/api/institut/pos-carts"),
    );
    return applyRemote(list.carts, data.cart);
  }, [active?.itemCount, applyRemote, flushSave]);

  const switchTo = useCallback(
    async (cartId: string, force = false) => {
      if (cartId === activeCartIdRef.current) return null;
      await flushSave().catch(() => undefined);
      const data = await parseJson<{ cart: PosCartDto }>(
        await fetch(`/api/institut/pos-carts/${cartId}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        }),
      );
      const list = await parseJson<{ carts: PosCartDto[] }>(
        await fetch("/api/institut/pos-carts"),
      );
      return applyRemote(list.carts, data.cart);
    },
    [applyRemote, flushSave],
  );

  const abandon = useCallback(
    async (cartId: string, force = false) => {
      await parseJson<{ ok: boolean }>(
        await fetch(
          `/api/institut/pos-carts/${cartId}${force ? "?force=1" : ""}`,
          { method: "DELETE" },
        ),
      );
      return ensure();
    },
    [ensure],
  );

  const pauseAutosave = useCallback(() => {
    skipSave.current = true;
  }, []);

  const afterCheckout = useCallback(async () => {
    skipSave.current = true;
    return ensure();
  }, [ensure]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const list = await parseJson<{ carts: PosCartDto[] }>(
            await fetch("/api/institut/pos-carts"),
          );
          setCarts(list.carts);
        } catch {
          /* keep current rail */
        }
      })();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading || !activeCartId || skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (active?.lockedByOther) return;
    const timer = window.setTimeout(() => {
      void flushSave().catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    local.cart,
    local.priceOverrides,
    local.clientId,
    local.staffId,
    local.lineStaff,
    local.appointmentId,
    local.notes,
    local.cartDiscountKind,
    local.cartDiscountValue,
    local.cartDiscountReason,
    local.cartDiscountCents,
    loading,
    activeCartId,
    active?.lockedByOther,
    flushSave,
  ]);

  return {
    carts,
    active,
    activeCartId,
    loading,
    error,
    setError,
    ensure,
    flushSave,
    createEmpty,
    switchTo,
    abandon,
    afterCheckout,
    pauseAutosave,
  };
}
