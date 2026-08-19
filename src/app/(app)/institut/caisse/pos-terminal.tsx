"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { checkoutPos, type ActionResult } from "../caisse-actions";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  applyPriceOverrides,
  createCustomPosKey,
  discountedUnitCents,
  resolvePosCatalogItem,
  type PosCatalogItem,
  type PosCategory,
  type PosServiceCategory,
} from "@/lib/institut/pos";
import {
  POS_FACET_ALL,
  POS_FACET_BESTSELLERS,
  POS_FACET_INTERNAL_UNCATEGORIZED,
  POS_FACET_MARQUES,
  POS_FACET_SOINS,
  POS_FACET_UNCATEGORIZED,
  POS_FACET_WOO_NONE,
  expandedWooGroup,
  filterPosCatalog,
  hasUncategorizedInternalProducts,
  hasUncategorizedServices,
  hasUncategorizedWooProducts,
  listProductCategoryFacets,
  listServiceCategoryFacets,
  listWooBrandChildren,
  listWooNavGroups,
  productFacetId,
  serviceFacetId,
} from "@/lib/institut/pos-catalog-filter";
import { computeCartTotals, resolveCartDiscountCents } from "@/lib/institut/pos-totals";
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
import { PosCartSwitcher } from "./pos-cart-switcher";
import { usePosCarts, type PosCartLocalState } from "./use-pos-carts";
import { PosLoyaltyPicker } from "./pos-loyalty-picker";
import { OpenSessionForm } from "./session/open-session-form";
import { InternalProductForm } from "./produits/internal-product-form";
import { ProductCategoriesDialog } from "./produits/product-categories-dialog";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import type { ProductCategoryRow } from "@/lib/institut/internal-products";

interface Option {
  id: string;
  label: string;
  clientId?: string;
}

const initial: ActionResult = {};

export function PosTerminal({
  catalog,
  serviceCategories = [],
  productCategories = [],
  clients,
  staff,
  appointments,
  initialAppointmentId,
  settings,
  sessionOpen,
  sessionPreviousDay = false,
  sessionPaused = false,
  requireSession,
  defaultOpeningFloatCents = 0,
  stripeEnabled,
  stripePublishableKey,
  stripeAccountId,
}: {
  catalog: PosCatalogItem[];
  serviceCategories?: PosServiceCategory[];
  productCategories?: ProductCategoryRow[];
  clients: Option[];
  staff: Option[];
  appointments: PosAppointmentOption[];
  initialAppointmentId?: string;
  settings: PosSettings;
  sessionOpen: boolean;
  sessionPreviousDay?: boolean;
  sessionPaused?: boolean;
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
  const [facet, setFacet] = useState(POS_FACET_ALL);
  const [clientId, setClientId] = useState(() => initialPrefill?.clientId ?? "");
  const [staffId, setStaffId] = useState(() => initialPrefill?.staffId ?? "");
  const [appointmentId, setAppointmentId] = useState(() => initialPrefill?.appointmentId ?? "");
  const [loyaltyRewardId, setLoyaltyRewardId] = useState("");
  const [loyaltyCreditCents, setLoyaltyCreditCents] = useState(0);
  const [loyaltyPreviewCents, setLoyaltyPreviewCents] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountCents, setPromoDiscountCents] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [notes, setNotes] = useState("");
  const [cartDiscountKind, setCartDiscountKind] = useState<"percent" | "fixed">("percent");
  const [cartDiscountValue, setCartDiscountValue] = useState("");
  const [cartDiscountReason, setCartDiscountReason] = useState("");
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(
    checkoutPos,
    initial,
  );
  const [lastSale, setLastSale] = useState<ActionResult | null>(null);
  const [lineDiscountKey, setLineDiscountKey] = useState<string | null>(null);
  const [lineDiscountKind, setLineDiscountKind] = useState<"percent" | "fixed">("percent");
  const [lineDiscountValue, setLineDiscountValue] = useState("");
  const [freeChargeOpen, setFreeChargeOpen] = useState(false);
  const [freeChargeAmount, setFreeChargeAmount] = useState("");
  const [freeChargeLabel, setFreeChargeLabel] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const lastRecordedSale = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (
      checkoutState.ok &&
      checkoutState.saleId &&
      checkoutState.saleId !== lastRecordedSale.current
    ) {
      lastRecordedSale.current = checkoutState.saleId;
      setLastSale(checkoutState);
      posCarts.pauseAutosave();
      setCart({});
      setPriceOverrides({});
      setPriceEdits({});
      setCartDiscountValue("");
      setCartDiscountReason("");
      setLoyaltyRewardId("");
      setLoyaltyCreditCents(0);
      setLoyaltyPreviewCents(0);
      setPromoInput("");
      setPromoCode("");
      setPromoDiscountCents(0);
      setPromoError(null);
      setAppointmentId("");
      void posCarts.afterCheckout().then((next) => {
        if (next) applyPosCartSnapshot(next);
      });
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
    setLoyaltyCreditCents(0);
    setLoyaltyPreviewCents(0);
  }

  function handleLoyaltyChange(rewardId: string, discountCents: number) {
    setLoyaltyRewardId(rewardId);
    if (rewardId) setLoyaltyCreditCents(0);
    setLoyaltyPreviewCents(discountCents);
  }

  function handleLoyaltyCreditChange(creditCents: number) {
    setLoyaltyCreditCents(creditCents);
    if (creditCents > 0) setLoyaltyRewardId("");
    setLoyaltyPreviewCents(creditCents);
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
      if (base != null && cents === base && !key.startsWith("custom:")) continue;
      out[key] = cents;
    }
    return out;
  }, [priceOverrides, cart, catalog]);

  const priceOverridesJson = useMemo(
    () => JSON.stringify(activeOverrides),
    [activeOverrides],
  );

  const filtered = useMemo(
    () => filterPosCatalog(catalog, tab, facet, query),
    [catalog, tab, facet, query],
  );

  const serviceCategoryFacets = useMemo(
    () => listServiceCategoryFacets(catalog, tab, serviceCategories),
    [catalog, tab, serviceCategories],
  );
  const wooNav = useMemo(
    () => listWooNavGroups(catalog, tab),
    [catalog, tab],
  );
  const wooGroup = expandedWooGroup(facet);
  const showUncategorized = useMemo(
    () => hasUncategorizedServices(catalog, tab),
    [catalog, tab],
  );
  const productCategoryFacets = useMemo(
    () => listProductCategoryFacets(tab, productCategories),
    [tab, productCategories],
  );
  const showUncategorizedInternal = useMemo(
    () => hasUncategorizedInternalProducts(catalog, tab),
    [catalog, tab],
  );
  const wooBrandChildren = useMemo(
    () => listWooBrandChildren(catalog, tab),
    [catalog, tab],
  );
  const activeBrandChildren = useMemo(() => {
    let brandName: string | null = null;
    if (facet.startsWith("woo-brand:")) {
      brandName = facet.slice("woo-brand:".length);
    } else if (facet.startsWith("woo-brand-child:")) {
      const rest = facet.slice("woo-brand-child:".length);
      const idx = rest.indexOf("::");
      brandName = idx > 0 ? rest.slice(0, idx) : null;
    }
    if (!brandName) return [];
    return wooBrandChildren.filter((child) => child.brand === brandName);
  }, [facet, wooBrandChildren]);
  const showUncategorizedWoo = useMemo(
    () => hasUncategorizedWooProducts(catalog, tab),
    [catalog, tab],
  );
  const selectedProductCategoryId =
    facet.startsWith("product:") && facet !== POS_FACET_INTERNAL_UNCATEGORIZED
      ? facet.slice("product:".length)
      : "";

  const categoryOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: POS_FACET_ALL, label: t("filters.allCategories") },
      { id: POS_FACET_BESTSELLERS, label: t("filters.bestsellers") },
    ];
    for (const category of serviceCategoryFacets) {
      opts.push({ id: serviceFacetId(category.id), label: category.name });
    }
    if (showUncategorized) {
      opts.push({ id: POS_FACET_UNCATEGORIZED, label: t("filters.uncategorized") });
    }
    for (const category of productCategoryFacets) {
      opts.push({ id: productFacetId(category.id), label: category.name });
    }
    if (showUncategorizedInternal) {
      opts.push({
        id: POS_FACET_INTERNAL_UNCATEGORIZED,
        label: t("filters.uncategorized"),
      });
    }
    if (wooNav.soins.length > 0) {
      opts.push({ id: POS_FACET_SOINS, label: t("filters.soins") });
    }
    if (wooNav.marques.length > 0) {
      opts.push({ id: POS_FACET_MARQUES, label: t("filters.marques") });
    }
    for (const brand of wooNav.marques) {
      opts.push({ id: brand.id, label: brand.name });
    }
    for (const child of wooBrandChildren) {
      opts.push({ id: child.id, label: child.label });
    }
    if (showUncategorizedWoo) {
      opts.push({ id: POS_FACET_WOO_NONE, label: t("filters.wooUncategorized") });
    }
    return opts;
  }, [
    productCategoryFacets,
    serviceCategoryFacets,
    showUncategorized,
    showUncategorizedInternal,
    showUncategorizedWoo,
    t,
    wooBrandChildren,
    wooNav.marques,
    wooNav.soins.length,
  ]);

  const categorySelectValue =
    wooGroup === "soins"
      ? POS_FACET_SOINS
      : wooGroup === "marques"
        ? POS_FACET_MARQUES
        : facet;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const pageFrom = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageTo = Math.min(filtered.length, currentPage * pageSize);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([key, qty]) => ({
        item: resolvePosCatalogItem(key, catalog, priceOverrides[key] ?? 0),
        key,
        qty,
      }))
      .filter((l) => l.item);
  }, [cart, catalog, priceOverrides]);

  const resolvedForTotals = useMemo(() => {
    const lines = Object.entries(cart).flatMap(([key, qty]) => {
      const item = resolvePosCatalogItem(key, catalog, priceOverrides[key] ?? 0);
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
  }, [cart, catalog, activeOverrides, priceOverrides]);

  const grossCents = useMemo(() => {
    if (resolvedForTotals.length === 0) return 0;
    return computeCartTotals(resolvedForTotals, {
      priceDisplay: settings.price_display,
      vatRateForType: (type) => vatRateForLineType(settings, type),
      cartDiscountCents: 0,
    }).gross_cents;
  }, [resolvedForTotals, settings]);

  function applyPosCartSnapshot(next: PosCartLocalState) {
    setCart(next.cart);
    setPriceOverrides(next.priceOverrides);
    setPriceEdits({});
    setClientId(next.clientId);
    setStaffId(next.staffId);
    setAppointmentId(next.appointmentId);
    setNotes(next.notes);
    setCartDiscountKind(next.cartDiscountKind);
    setCartDiscountValue(next.cartDiscountValue);
    setCartDiscountReason(next.cartDiscountReason);
  }

  const discountCents = useMemo(() => {
    if (promoCode) return 0;
    const n = Number.parseFloat(cartDiscountValue.replace(",", "."));
    return resolveCartDiscountCents({
      kind: cartDiscountKind,
      value: Number.isFinite(n) ? n : 0,
      grossCents,
    });
  }, [cartDiscountKind, cartDiscountValue, promoCode, grossCents]);

  const posCarts = usePosCarts({
    cart,
    priceOverrides,
    clientId,
    staffId,
    appointmentId,
    notes,
    cartDiscountKind,
    cartDiscountValue,
    cartDiscountReason,
    cartDiscountCents: discountCents,
  });
  const bootstrappedCarts = useRef(false);

  useEffect(() => {
    if (bootstrappedCarts.current) return;
    bootstrappedCarts.current = true;
    const localHasItems = Object.values(cart).some((qty) => qty > 0);
    void posCarts.ensure().then((remote) => {
      if (!remote) return;
      const remoteHasItems = Object.values(remote.cart).some((qty) => qty > 0);
      if (localHasItems && remoteHasItems) {
        void posCarts.createEmpty();
        return;
      }
      if (localHasItems) return;
      applyPosCartSnapshot(remote);
    });
    // Bootstrap unique au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setCartDiscountValue("");
      setCartDiscountReason("");
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

  function addFreeCharge() {
    const cents = eurosToCents(freeChargeAmount);
    if (cents == null || cents <= 0) return;
    const key = createCustomPosKey(freeChargeLabel);
    setLastSale(null);
    setCart((c) => ({ ...c, [key]: 1 }));
    setPriceOverrides((po) => ({ ...po, [key]: cents }));
    setFreeChargeOpen(false);
    setFreeChargeAmount("");
    setFreeChargeLabel("");
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
    setCartDiscountValue("");
    setCartDiscountReason("");
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

  function applyLineDiscount(key: string, catalogCents: number) {
    const n = Number.parseFloat(lineDiscountValue.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    const cents = discountedUnitCents(catalogCents, lineDiscountKind, n);
    setLastSale(null);
    if (cents === catalogCents) {
      resetPrice(key);
    } else {
      setPriceOverrides((po) => ({ ...po, [key]: cents }));
      setPriceEdits((pe) => ({ ...pe, [key]: (cents / 100).toFixed(2) }));
    }
    setLineDiscountKey(null);
    setLineDiscountValue("");
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
    posCarts.pauseAutosave();
    setCart({});
    setPriceOverrides({});
    setPriceEdits({});
    setCartDiscountKind("percent");
    setCartDiscountValue("");
    setCartDiscountReason("");
    setLoyaltyRewardId("");
    setLoyaltyCreditCents(0);
    setLoyaltyPreviewCents(0);
    setNotes("");
    void posCarts.afterCheckout().then((next) => {
      if (next) applyPosCartSnapshot(next);
    });
    void message;
  }

  const tCheckout = useTranslations("pos.checkout");

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setFacet(POS_FACET_ALL);
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
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
          <CatalogCategorySelect
            value={categorySelectValue}
            options={categoryOptions}
            onChange={(id) => {
              setFacet(id);
              setPage(1);
            }}
            searchPlaceholder={t("filters.searchCategory")}
            ariaLabel={t("filters.categoryAria")}
          />
        </div>

        {wooGroup === "soins" && wooNav.soins.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {wooNav.soins.map((child) => (
              <CatalogFacetChip
                key={child.id}
                active={facet === child.id}
                onClick={() => {
                  setFacet(child.id);
                  setPage(1);
                }}
              >
                {child.id === "woo-soins:autres" ? t("filters.soinsOther") : child.name}
              </CatalogFacetChip>
            ))}
          </div>
        ) : null}

        {wooGroup === "marques" && wooNav.marques.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {wooNav.marques.map((child) => (
              <CatalogFacetChip
                key={child.id}
                active={facet === child.id}
                onClick={() => {
                  setFacet(child.id);
                  setPage(1);
                }}
              >
                {child.name}
              </CatalogFacetChip>
            ))}
          </div>
        ) : null}

        {wooGroup === "marques" && activeBrandChildren.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pl-2">
            {activeBrandChildren.map((child) => (
              <CatalogFacetChip
                key={child.id}
                active={facet === child.id}
                onClick={() => {
                  setFacet(child.id);
                  setPage(1);
                }}
              >
                {child.child}
              </CatalogFacetChip>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
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

        {tab === "internal" || tab === "service" ? (
          <div className="flex flex-wrap gap-2">
            {tab === "service" ? (
              <Link href="/institut/prestations">
                <Button type="button" variant="outline" className="h-8">
                  {t("manageServices")}
                </Button>
              </Link>
            ) : null}
            {tab === "internal" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() => setCategoriesOpen(true)}
                >
                  {t("manageProductCategories")}
                </Button>
                <Button
                  type="button"
                  className="h-8"
                  onClick={() => setProductDialogOpen(true)}
                >
                  + {t("addInternalProduct")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              {query.trim()
                ? t("noResults", { query: query.trim() })
                : facet === POS_FACET_BESTSELLERS
                  ? t("noBestsellers")
                  : tab === "internal"
                    ? t("emptyInternal")
                    : tab === "service"
                      ? t("emptyServices")
                      : t("emptyCategory")}
            </p>
            {tab === "internal" && !query.trim() ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() => setCategoriesOpen(true)}
                >
                  {t("manageProductCategories")}
                </Button>
                <Button
                  type="button"
                  className="h-8"
                  onClick={() => setProductDialogOpen(true)}
                >
                  + {t("addInternalProduct")}
                </Button>
              </div>
            ) : null}
            {tab === "service" && !query.trim() ? (
              <div className="mt-3">
                <Link href="/institut/prestations">
                  <Button type="button" variant="outline" className="h-8">
                    {t("manageServices")}
                  </Button>
                </Link>
              </div>
            ) : null}
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
        ) : sessionPaused ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">{t("sessionPausedTitle")}</p>
            <p className="mt-0.5 text-sm text-amber-900/80">{t("sessionPausedBody")}</p>
            <Link
              href="/institut/caisse/session"
              className="mt-2 inline-flex h-8 items-center rounded-lg bg-amber-900 px-3 text-xs font-medium text-white hover:bg-amber-950"
            >
              {t("sessionPausedCta")}
            </Link>
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

        <PosCartSwitcher
          carts={posCarts.carts}
          activeCartId={posCarts.activeCartId}
          onSelect={posCarts.switchTo}
          onAdd={posCarts.createEmpty}
          onAbandon={posCarts.abandon}
          onApplied={applyPosCartSnapshot}
        />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("cart.title")}
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFreeChargeOpen((open) => !open)}
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              {t("cart.freeCharge")}
            </button>
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
        </div>

        {freeChargeOpen ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-600">{t("cart.freeChargeHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                inputMode="decimal"
                placeholder={t("cart.freeChargeAmount")}
                value={freeChargeAmount}
                onChange={(e) => setFreeChargeAmount(e.target.value)}
              />
              <Input
                placeholder={t("cart.freeChargeLabel")}
                value={freeChargeLabel}
                onChange={(e) => setFreeChargeLabel(e.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!eurosToCents(freeChargeAmount)}
              onClick={addFreeCharge}
            >
              {t("cart.freeChargeAdd")}
            </Button>
          </div>
        ) : null}

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
                  <div className="flex flex-wrap items-center gap-2">
                    {overridden && defaultCents > currentCents ? (
                      <span className="text-[11px] font-medium text-violet-700">
                        {t("cart.lineDiscountApplied", {
                          amount: money(defaultCents - currentCents),
                        })}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setLineDiscountKey(lineDiscountKey === key ? null : key);
                        setLineDiscountKind("percent");
                        setLineDiscountValue("");
                      }}
                      className="text-[11px] font-medium text-slate-600 underline decoration-dotted hover:text-slate-900"
                    >
                      {t("cart.lineDiscount")}
                    </button>
                  </div>
                  {lineDiscountKey === key ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={lineDiscountKind}
                        onChange={(e) =>
                          setLineDiscountKind(e.target.value === "fixed" ? "fixed" : "percent")
                        }
                        className="h-8 w-auto text-xs"
                        aria-label={t("cart.lineDiscountType")}
                      >
                        <option value="percent">{t("cart.lineDiscountPercent")}</option>
                        <option value="fixed">{t("cart.lineDiscountFixed")}</option>
                      </Select>
                      <Input
                        inputMode="decimal"
                        className="h-8 w-20 text-xs"
                        placeholder={lineDiscountKind === "percent" ? "10" : "5,00"}
                        value={lineDiscountValue}
                        onChange={(e) => setLineDiscountValue(e.target.value)}
                        aria-label={t("cart.lineDiscountValue")}
                      />
                      <button
                        type="button"
                        onClick={() => applyLineDiscount(key, defaultCents)}
                        className="h-8 rounded-md bg-slate-900 px-2.5 text-[11px] font-medium text-white"
                      >
                        {t("cart.lineDiscountApply")}
                      </button>
                    </div>
                  ) : null}
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
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("cart.discountAdd")}
                </p>
                <div className="flex gap-2">
                  <Select
                    id="cart-discount-kind"
                    value={cartDiscountKind}
                    onChange={(e) =>
                      setCartDiscountKind(e.target.value === "fixed" ? "fixed" : "percent")
                    }
                    aria-label={t("cart.discountType")}
                  >
                    <option value="percent">{t("cart.discountPercent")}</option>
                    <option value="fixed">{t("cart.discountFixed")}</option>
                  </Select>
                  <Input
                    id="cart-discount"
                    type="number"
                    min={0}
                    step={cartDiscountKind === "percent" ? "1" : "0.01"}
                    max={cartDiscountKind === "percent" ? "100" : (grossCents / 100).toFixed(2)}
                    value={cartDiscountValue}
                    onChange={(e) => setCartDiscountValue(e.target.value)}
                    placeholder={cartDiscountKind === "percent" ? "10" : "15"}
                    aria-label={t("cart.discountValue")}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {settings.discount_reasons.map((reason) => {
                    const selected = cartDiscountReason === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() =>
                          setCartDiscountReason(selected ? "" : reason)
                        }
                        className={
                          selected
                            ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                            : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                        }
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={
                    settings.discount_reasons.includes(cartDiscountReason)
                      ? ""
                      : cartDiscountReason
                  }
                  onChange={(e) => setCartDiscountReason(e.target.value)}
                  placeholder={t("cart.discountReasonOther")}
                  aria-label={t("cart.discountReason")}
                />
                {discountCents > 0 ? (
                  <p className="text-xs text-emerald-700">
                    {t("cart.discountApplied", {
                      amount: money(discountCents),
                      total: money(Math.max(0, grossCents - discountCents)),
                    })}
                  </p>
                ) : null}
              </div>
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
            setLoyaltyCreditCents(0);
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
            selectedCreditCents={loyaltyCreditCents}
            onRewardChange={handleLoyaltyChange}
            onCreditChange={handleLoyaltyCreditChange}
            currency={settings.currency}
          />
        ) : null}

        {!cartEmpty ? (
          <CheckoutPanel
            cartJson={cartJson}
            clientId={clientId}
            staffId={staffId}
            appointmentId={appointmentId}
            notes={[
              notes.trim(),
              !promoCode && cartDiscountReason.trim()
                ? `${t("cart.discountReasonPrefix")}: ${cartDiscountReason.trim()}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")}
            discountReason={!promoCode ? cartDiscountReason.trim() : ""}
            cartDiscountEuros={(discountCents / 100).toFixed(2)}
            loyaltyRewardId={loyaltyRewardId}
            loyaltyCreditCents={loyaltyCreditCents}
            promoCode={promoCode}
            priceOverridesJson={priceOverridesJson}
            posCartId={posCarts.activeCartId}
            totals={totals}
            settings={settings}
            stripeEnabled={Boolean(stripeEnabled)}
            stripePublishableKey={stripePublishableKey}
            stripeAccountId={stripeAccountId}
            disabled={
              cartEmpty ||
              sessionPaused ||
              sessionPreviousDay ||
              (requireSession && !sessionOpen) ||
              Boolean(posCarts.active?.lockedByOther)
            }
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
    {productDialogOpen ? (
      <FormDialog
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        title={t("addInternalProduct")}
      >
        <InternalProductForm
          categories={productCategories}
          defaultCategoryId={selectedProductCategoryId || null}
          onSuccess={() => {
            setProductDialogOpen(false);
            router.refresh();
          }}
        />
      </FormDialog>
    ) : null}
    {categoriesOpen ? (
      <ProductCategoriesDialog
        open={categoriesOpen}
        categories={productCategories}
        onClose={() => {
          setCategoriesOpen(false);
          router.refresh();
        }}
      />
    ) : null}
    </>
  );
}

function CatalogCategorySelect({
  value,
  options,
  onChange,
  searchPlaceholder,
  ariaLabel,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  searchPlaceholder: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    setQ("");
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full shrink-0 sm:w-72">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        <span className="min-w-0 truncate">{selected?.label ?? ariaLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-1.5">
            <Input
              ref={searchRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8"
              aria-label={searchPlaceholder}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">{searchPlaceholder}</li>
            ) : (
              filtered.map((option) => {
                const active = option.id === value;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CatalogFacetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-7 items-center rounded-full bg-slate-900 px-2.5 text-xs font-medium text-white"
          : "inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
      }
    >
      {children}
    </button>
  );
}
