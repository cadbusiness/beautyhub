"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { checkoutPos, type ActionResult } from "../caisse-actions";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  applyPriceOverrides,
  type PosCatalogItem,
  type PosCategory,
} from "@/lib/institut/pos";
import { computeCartTotals } from "@/lib/institut/pos-totals";
import {
  formatPosMoney,
  vatRateForLineType,
  type PosSettings,
} from "@/lib/institut/pos-settings";
import {
  applyPosAppointmentPrefill,
  type PosAppointmentOption,
} from "@/lib/institut/pos-appointment";
import { CheckoutPanel } from "./checkout-panel";
import { PosLoyaltyPicker } from "./pos-loyalty-picker";
import { OpenSessionForm } from "./session/open-session-form";

interface Option {
  id: string;
  label: string;
  clientId?: string;
}

const initial: ActionResult = {};

export function PosTerminal({
  catalog,
  clients,
  staff,
  appointments,
  initialAppointmentId,
  settings,
  sessionOpen,
  sessionPreviousDay = false,
  requireSession,
  defaultOpeningFloatCents = 0,
  stripeEnabled,
  stripePublishableKey,
  stripeAccountId,
}: {
  catalog: PosCatalogItem[];
  clients: Option[];
  staff: Option[];
  appointments: PosAppointmentOption[];
  initialAppointmentId?: string;
  settings: PosSettings;
  sessionOpen: boolean;
  sessionPreviousDay?: boolean;
  requireSession: boolean;
  defaultOpeningFloatCents?: number;
  stripeEnabled?: boolean;
  stripePublishableKey?: string;
  stripeAccountId?: string;
}) {
  const t = useTranslations("pos.terminal");
  const locale = useLocale();
  const money = (cents: number) => formatPosMoney(cents, settings, locale);
  const initialAppt = initialAppointmentId
    ? appointments.find((a) => a.id === initialAppointmentId)
    : undefined;
  const initialPrefill = initialAppt ? applyPosAppointmentPrefill(initialAppt) : null;

  const [cart, setCart] = useState<Record<string, number>>(() => initialPrefill?.cart ?? {});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<PosCategory>("all");
  const [query, setQuery] = useState("");
  const [wooCategory, setWooCategory] = useState("all");
  const [clientId, setClientId] = useState(() => initialPrefill?.clientId ?? "");
  const [staffId, setStaffId] = useState(() => initialPrefill?.staffId ?? "");
  const [appointmentId, setAppointmentId] = useState(() => initialPrefill?.appointmentId ?? "");
  const [loyaltyRewardId, setLoyaltyRewardId] = useState("");
  const [loyaltyPreviewCents, setLoyaltyPreviewCents] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountCents, setPromoDiscountCents] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [notes, setNotes] = useState("");
  const [cartDiscountEuros, setCartDiscountEuros] = useState("0");
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(
    checkoutPos,
    initial,
  );
  const [lastSale, setLastSale] = useState<ActionResult | null>(null);
  const lastRecordedSale = useRef<string | null>(null);

  useEffect(() => {
    if (
      checkoutState.ok &&
      checkoutState.saleId &&
      checkoutState.saleId !== lastRecordedSale.current
    ) {
      lastRecordedSale.current = checkoutState.saleId;
      setLastSale(checkoutState);
      setCart({});
      setPriceOverrides({});
      setPriceEdits({});
      setCartDiscountEuros("0");
      setLoyaltyRewardId("");
      setLoyaltyPreviewCents(0);
      setPromoInput("");
      setPromoCode("");
      setPromoDiscountCents(0);
      setPromoError(null);
      setAppointmentId("");
    }
  }, [checkoutState]);

  function selectAppointment(id: string) {
    setAppointmentId(id);
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    if (appt.clientId) setClientId(appt.clientId);
    if (appt.staffId) setStaffId(appt.staffId);
    if (Object.keys(appt.prefillCart).length > 0) {
      setCart(appt.prefillCart);
      setPriceOverrides({});
      setPriceEdits({});
      setLastSale(null);
    }
    setLoyaltyRewardId("");
    setLoyaltyPreviewCents(0);
  }

  function handleLoyaltyChange(rewardId: string, discountCents: number) {
    setLoyaltyRewardId(rewardId);
    setLoyaltyPreviewCents(discountCents);
  }

  const tabs: { id: PosCategory; label: string }[] = [
    { id: "all", label: t("tabs.all") },
    { id: "service", label: t("tabs.services") },
    { id: "woocommerce", label: t("tabs.woo") },
    { id: "internal", label: t("tabs.internal") },
  ];

  const categoryLabel: Record<string, string> = {
    service: t("categories.service"),
    woocommerce: t("categories.woocommerce"),
    internal: t("categories.internal"),
  };

  const cartJson = JSON.stringify(cart);
  const cartEmpty = Object.keys(cart).length === 0;

  const activeOverrides = useMemo(() => {
    const catalogPrice = new Map(catalog.map((i) => [i.key, i.price_cents]));
    const out: Record<string, number> = {};
    for (const [key, cents] of Object.entries(priceOverrides)) {
      if (!(key in cart)) continue;
      const base = catalogPrice.get(key);
      if (base != null && cents === base) continue;
      out[key] = cents;
    }
    return out;
  }, [priceOverrides, cart, catalog]);

  const priceOverridesJson = useMemo(
    () => JSON.stringify(activeOverrides),
    [activeOverrides],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (tab !== "all" && item.category !== tab) return false;
      if (wooCategory !== "all" && (tab === "all" || tab === "woocommerce")) {
        if (item.category !== "woocommerce") return false;
        const names = item.woo_categories ?? [];
        if (!names.some((name) => name === wooCategory)) return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku?.toLowerCase().includes(q) ?? false) ||
        (item.woo_categories?.some((name) => name.toLowerCase().includes(q)) ??
          false)
      );
    });
  }, [catalog, tab, query, wooCategory]);

  const wooCategoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const item of catalog) {
      if (item.category !== "woocommerce") continue;
      for (const name of item.woo_categories ?? []) {
        const trimmed = name.trim();
        if (trimmed) categories.add(trimmed);
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, "fr"));
  }, [catalog]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const pageFrom = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageTo = Math.min(filtered.length, currentPage * pageSize);

  const cartLines = useMemo(() => {
    const byKey = new Map(catalog.map((i) => [i.key, i]));
    return Object.entries(cart)
      .map(([key, qty]) => ({ item: byKey.get(key), key, qty }))
      .filter((l) => l.item);
  }, [cart, catalog]);

  const resolvedForTotals = useMemo(() => {
    const byKey = new Map(catalog.map((i) => [i.key, i]));
    const lines = Object.entries(cart).flatMap(([key, qty]) => {
      const item = byKey.get(key);
      if (!item) return [];
      return [
        {
          key,
          type: item.type,
          name: item.name,
          quantity: qty,
          unit_price_cents: item.price_cents,
          product_id: item.type === "product" ? item.id : null,
          service_id: item.type === "service" ? item.id : null,
          woo_id: null,
        },
      ];
    });
    return applyPriceOverrides(lines, activeOverrides);
  }, [cart, catalog, activeOverrides]);

  const discountCents = useMemo(() => {
    if (promoCode) return 0;
    const n = Number.parseFloat(cartDiscountEuros.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [cartDiscountEuros, promoCode]);

  const grossCents = useMemo(() => {
    if (resolvedForTotals.length === 0) return 0;
    return computeCartTotals(resolvedForTotals, {
      priceDisplay: settings.price_display,
      vatRateForType: (type) => vatRateForLineType(settings, type),
      cartDiscountCents: 0,
    }).gross_cents;
  }, [resolvedForTotals, settings]);

  const subtotalForLoyalty = useMemo(() => {
    if (resolvedForTotals.length === 0) return 0;
    return computeCartTotals(resolvedForTotals, {
      priceDisplay: settings.price_display,
      vatRateForType: (type) => vatRateForLineType(settings, type),
      cartDiscountCents: discountCents + promoDiscountCents,
    }).subtotal_cents;
  }, [resolvedForTotals, settings, discountCents, promoDiscountCents]);

  const totalDiscountCents = discountCents + promoDiscountCents + loyaltyPreviewCents;

  async function applyPromoCode() {
    const code = promoInput.trim();
    if (!code || cartEmpty) return;
    setPromoPending(true);
    setPromoError(null);
    try {
      const params = new URLSearchParams({
        code,
        subtotal_cents: String(grossCents),
      });
      if (clientId) params.set("client_id", clientId);
      const res = await fetch(`/api/institut/pos/promo-validate?${params}`);
      const data = (await res.json()) as {
        valid?: boolean;
        error?: string | null;
        discount_cents?: number;
        code?: string | null;
      };
      if (!data.valid) {
        setPromoCode("");
        setPromoDiscountCents(0);
        setPromoError(data.error ?? "promo_invalid");
        return;
      }
      setPromoCode(data.code ?? code.toUpperCase());
      setPromoDiscountCents(data.discount_cents ?? 0);
      setCartDiscountEuros("0");
      setPromoError(null);
    } catch {
      setPromoError("promo_invalid");
      setPromoCode("");
      setPromoDiscountCents(0);
    } finally {
      setPromoPending(false);
    }
  }

  function clearPromoCode() {
    setPromoInput("");
    setPromoCode("");
    setPromoDiscountCents(0);
    setPromoError(null);
  }

  const totals = useMemo(() => {
    if (resolvedForTotals.length === 0) {
      return {
        subtotal_cents: 0,
        vat_cents: 0,
        total_cents: 0,
        cart_discount_cents: 0,
        gross_cents: 0,
        lines: [],
      };
    }
    return computeCartTotals(resolvedForTotals, {
      priceDisplay: settings.price_display,
      vatRateForType: (type) => vatRateForLineType(settings, type),
      cartDiscountCents: totalDiscountCents,
    });
  }, [resolvedForTotals, settings, totalDiscountCents]);

  function add(key: string) {
    setLastSale(null);
    setCart((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
  }

  function remove(key: string) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[key] ?? 0) - 1;
      if (q <= 0) {
        delete next[key];
        setPriceOverrides((po) => {
          if (!(key in po)) return po;
          const nextPo = { ...po };
          delete nextPo[key];
          return nextPo;
        });
        setPriceEdits((pe) => {
          if (!(key in pe)) return pe;
          const nextPe = { ...pe };
          delete nextPe[key];
          return nextPe;
        });
      } else {
        next[key] = q;
      }
      return next;
    });
  }

  function clearCart() {
    setCart({});
    setPriceOverrides({});
    setPriceEdits({});
    setCartDiscountEuros("0");
  }

  function eurosToCents(input: string): number | null {
    const trimmed = input.trim().replace(",", ".");
    if (trimmed === "") return null;
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function commitPriceEdit(key: string, defaultCents: number) {
    const draft = priceEdits[key];
    if (draft === undefined) return;
    const cents = eurosToCents(draft);
    setPriceEdits((pe) => {
      if (!(key in pe)) return pe;
      const next = { ...pe };
      delete next[key];
      return next;
    });
    if (cents == null || cents === defaultCents) {
      setPriceOverrides((po) => {
        if (!(key in po)) return po;
        const next = { ...po };
        delete next[key];
        return next;
      });
    } else {
      setPriceOverrides((po) => ({ ...po, [key]: cents }));
    }
  }

  function resetPrice(key: string) {
    setPriceOverrides((po) => {
      if (!(key in po)) return po;
      const next = { ...po };
      delete next[key];
      return next;
    });
    setPriceEdits((pe) => {
      if (!(key in pe)) return pe;
      const next = { ...pe };
      delete next[key];
      return next;
    });
  }

  function handleStripeSuccess(message: string) {
    setCart({});
    setPriceOverrides({});
    setPriceEdits({});
    setCartDiscountEuros("0");
    setLoyaltyRewardId("");
    setLoyaltyPreviewCents(0);
    setNotes("");
    void message;
  }

  const tCheckout = useTranslations("pos.checkout");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            autoComplete="off"
            className="pl-9"
            placeholder={t("searchArticles")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            aria-label={t("searchAria")}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {wooCategoryOptions.length > 0 ? (
              <>
                <label htmlFor="woo-category-filter">{t("filters.wooCategory")}</label>
                <Select
                  id="woo-category-filter"
                  value={wooCategory}
                  onChange={(e) => {
                    setWooCategory(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 min-w-40"
                >
                  <option value="all">{t("filters.wooCategoryAll")}</option>
                  {wooCategoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </>
            ) : null}
            <span>{t("pagination.showing", { from: pageFrom, to: pageTo, total: filtered.length })}</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size">{t("pagination.perPage")}</label>
            <Select
              id="page-size"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 w-24"
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
              <option value="96">96</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              {query.trim() ? t("noResults", { query: query.trim() }) : t("emptyCategory")}
            </p>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {pagedItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => add(item.key)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-400"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="mb-2 h-20 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="mb-2 flex h-20 w-full items-center justify-center rounded-lg text-2xl"
                    style={{
                      backgroundColor: item.color ? `${item.color}22` : undefined,
                    }}
                  >
                    {item.type === "service" ? "✨" : "📦"}
                  </div>
                )}
                <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {item.visibility === "extra_only" ? t("categories.extra") : categoryLabel[item.category]}
                </span>
                <p className="line-clamp-2 text-sm font-medium text-slate-900">
                  {item.name}
                </p>
                <p className="text-sm text-slate-500">
                  {money(item.price_cents)}
                  {item.duration_min ? ` · ${item.duration_min} min` : ""}
                </p>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>{t("pagination.page", { current: currentPage, total: totalPages })}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pagination.prev")}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      <Card className="h-fit space-y-4 lg:sticky lg:top-4">
        {lastSale?.ok && lastSale.saleId ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <p>{lastSale.message}</p>
            <Link
              href={`/institut/caisse/ticket/${lastSale.saleId}`}
              className="mt-1 inline-block underline"
              target="_blank"
            >
              {tCheckout("viewTicket")}
            </Link>
          </div>
        ) : null}

        {!sessionOpen ? (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div>
              <p className="text-sm font-medium text-amber-950">{t("sessionClosedTitle")}</p>
              <p className="mt-0.5 text-sm text-amber-900/80">{t("sessionClosedBody")}</p>
              <p className="mt-1 text-xs text-amber-900/70">{t("sessionClosedGuide")}</p>
            </div>
            <OpenSessionForm
              defaultFloat={defaultOpeningFloatCents}
              currency={settings.currency}
              compact
            />
          </div>
        ) : sessionPreviousDay ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">{t("sessionPreviousDayTitle")}</p>
            <p className="mt-0.5 text-sm text-amber-900/80">{t("sessionPreviousDayBody")}</p>
            <Link
              href="/institut/caisse/session"
              className="mt-2 inline-flex h-8 items-center rounded-lg bg-amber-900 px-3 text-xs font-medium text-white hover:bg-amber-950"
            >
              {t("sessionPreviousDayCta")}
            </Link>
          </div>
        ) : null}

        {initialAppt && appointmentId === initialAppt.id ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">{t("appointmentLinked")}</p>
            <p className="mt-0.5 text-xs text-blue-800">{initialAppt.label}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("cart.title")}
          </h2>
          {!cartEmpty ? (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {t("cart.clear")}
            </button>
          ) : null}
        </div>

        {cartLines.length === 0 ? (
          <p className="text-sm text-slate-500">{t("cart.empty")}</p>
        ) : (
          <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {cartLines.map(({ item, key, qty }) => {
              if (!item) return null;
              const defaultCents = item.price_cents;
              const currentCents = priceOverrides[key] ?? defaultCents;
              const overridden = key in priceOverrides;
              const editValue = priceEdits[key] ?? (currentCents / 100).toFixed(2);
              const lineTotalCents = currentCents * qty;
              return (
                <li key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {item.name}
                      {item.visibility === "extra_only" ? (
                        <span className="ml-1 text-[10px] font-medium uppercase text-violet-600">
                          {t("cart.extraBadge")}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => remove(key)}
                        className="h-7 w-7 rounded text-slate-500 hover:bg-slate-100"
                        aria-label={t("cart.qtyDecrease")}
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => add(key)}
                        className="h-7 w-7 rounded text-slate-500 hover:bg-slate-100"
                        aria-label={t("cart.qtyIncrease")}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={editValue}
                        onChange={(e) =>
                          setPriceEdits((pe) => ({ ...pe, [key]: e.target.value }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => commitPriceEdit(key, defaultCents)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            setPriceEdits((pe) => {
                              if (!(key in pe)) return pe;
                              const next = { ...pe };
                              delete next[key];
                              return next;
                            });
                            e.currentTarget.blur();
                          }
                        }}
                        aria-label={t("cart.unitPriceAria")}
                        className={`h-8 w-24 rounded-md border bg-white pl-2 pr-6 text-sm tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-ring/20 ${
                          overridden
                            ? "border-violet-300 focus:border-violet-400"
                            : "border-slate-200 focus:border-ring"
                        }`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                        €
                      </span>
                    </div>
                    {overridden ? (
                      <button
                        type="button"
                        onClick={() => resetPrice(key)}
                        className="text-[11px] text-slate-500 underline decoration-dotted hover:text-slate-700"
                        title={t("cart.resetPriceTitle", {
                          price: money(defaultCents),
                        })}
                      >
                        {t("cart.resetPrice")}
                      </button>
                    ) : null}
                    <span className="ml-auto tabular-nums text-slate-500">
                      {qty > 1 ? (
                        <span className="font-medium text-slate-700">
                          = {money(lineTotalCents)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!cartEmpty ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500" htmlFor="promo-code">
              {t("cart.promoCode")}
            </label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={t("cart.promoPlaceholder")}
                className="uppercase"
                disabled={Boolean(promoCode)}
              />
              {promoCode ? (
                <button
                  type="button"
                  onClick={clearPromoCode}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {t("cart.promoClear")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyPromoCode}
                  disabled={promoPending || !promoInput.trim()}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {promoPending ? t("cart.promoApplying") : t("cart.promoApply")}
                </button>
              )}
            </div>
            {promoCode && promoDiscountCents > 0 ? (
              <p className="text-xs text-emerald-700">
                {t("cart.promoApplied", {
                  code: promoCode,
                  amount: money(promoDiscountCents),
                })}
              </p>
            ) : null}
            {promoError ? (
              <p className="text-xs text-red-600">
                {t(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic error code from API
                  `cart.promoErrors.${promoError}` as any,
                )}
              </p>
            ) : null}
            {!promoCode ? (
              <>
                <label className="block text-xs text-slate-500" htmlFor="cart-discount">
                  {t("cart.discount")}
                </label>
                <Input
                  id="cart-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  max={(grossCents / 100).toFixed(2)}
                  value={cartDiscountEuros}
                  onChange={(e) => setCartDiscountEuros(e.target.value)}
                />
              </>
            ) : null}
          </div>
        ) : null}

        <Select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          aria-label={t("cart.staffAria")}
        >
          <option value="">{t("cart.noStaff")}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>

        <Select
          value={appointmentId}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              setAppointmentId("");
              return;
            }
            selectAppointment(id);
          }}
          aria-label={t("cart.appointmentAria")}
        >
          <option value="">{t("cart.noAppointment")}</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>

        <Select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setLoyaltyRewardId("");
            setLoyaltyPreviewCents(0);
          }}
          aria-label={t("cart.clientAria")}
        >
          <option value="">{t("cart.noClient")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("cart.notePlaceholder")}
          rows={2}
        />

        {!cartEmpty ? (
          <PosLoyaltyPicker
            clientId={clientId}
            subtotalCents={subtotalForLoyalty}
            selectedRewardId={loyaltyRewardId}
            onRewardChange={handleLoyaltyChange}
            currency={settings.currency}
          />
        ) : null}

        {!cartEmpty ? (
          <CheckoutPanel
            cartJson={cartJson}
            clientId={clientId}
            staffId={staffId}
            appointmentId={appointmentId}
            notes={notes}
            cartDiscountEuros={cartDiscountEuros}
            loyaltyRewardId={loyaltyRewardId}
            promoCode={promoCode}
            priceOverridesJson={priceOverridesJson}
            totals={totals}
            settings={settings}
            stripeEnabled={Boolean(stripeEnabled)}
            stripePublishableKey={stripePublishableKey}
            stripeAccountId={stripeAccountId}
            disabled={cartEmpty || (requireSession && !sessionOpen)}
            checkoutAction={checkoutAction}
            checkoutPending={checkoutPending}
            checkoutState={checkoutState}
            onSuccess={handleStripeSuccess}
          />
        ) : (
          <p className="text-sm text-slate-400">{t("cart.addToCheckout")}</p>
        )}

        <Link
          href="/compte/institut/caisse"
          className="block text-center text-xs text-slate-400 hover:text-slate-600"
        >
          {t("cart.settingsLink")}
        </Link>
      </Card>
    </div>
  );
}
