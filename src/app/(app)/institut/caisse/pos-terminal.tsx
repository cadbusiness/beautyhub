"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { checkoutPos, type ActionResult } from "../caisse-actions";
import { Input, Select } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
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
  findCatalogItemByScanCode,
  looksLikeScanCode,
  normalizeScanCode,
} from "@/lib/institut/pos-scan";
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
import { PosTicketPanel } from "./pos-ticket-panel";
import { usePosCarts, type PosCartLocalState } from "./use-pos-carts";
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
  operatorStaffId = "",
  catalogActions,
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
  operatorStaffId?: string;
  catalogActions?: ReactNode;
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
  const [staffId, setStaffId] = useState(
    () => initialPrefill?.staffId || operatorStaffId || "",
  );
  const [lineStaff, setLineStaff] = useState<Record<string, string>>(() => {
    if (!initialPrefill?.staffId) return {};
    return Object.fromEntries(
      Object.keys(initialPrefill.cart).map((key) => [key, initialPrefill.staffId]),
    );
  });
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
  const [expandedLineKey, setExpandedLineKey] = useState<string | null>(null);
  const [ticketExtrasOpen, setTicketExtrasOpen] = useState(false);
  const [freeChargeOpen, setFreeChargeOpen] = useState(false);
  const [freeChargeAmount, setFreeChargeAmount] = useState("");
  const [freeChargeLabel, setFreeChargeLabel] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [pendingScanSku, setPendingScanSku] = useState("");
  const [scanNotice, setScanNotice] = useState<string | null>(null);
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
      setLineStaff({});
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
      if (appt.staffId) {
        setLineStaff(
          Object.fromEntries(
            Object.keys(appt.prefillCart).map((key) => [key, appt.staffId!]),
          ),
        );
      }
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
    setLineStaff(next.lineStaff);
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
    lineStaff,
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

  function applyScanCode(raw: string): boolean {
    const code = normalizeScanCode(raw);
    if (!code) return false;
    const match = findCatalogItemByScanCode(catalog, code);
    if (match) {
      add(match.key);
      setQuery("");
      setPage(1);
      setScanNotice(t("scanAdded", { name: match.name }));
      setPendingScanSku("");
      return true;
    }
    if (looksLikeScanCode(code)) {
      setQuery(code);
      setPage(1);
      setPendingScanSku(code);
      setScanNotice(t("scanUnknown", { code }));
    }
    return false;
  }

  function openCreateFromScan(sku?: string) {
    setPendingScanSku(sku ? normalizeScanCode(sku) : "");
    setProductDialogOpen(true);
  }

  const applyScanRef = useRef(applyScanCode);
  applyScanRef.current = applyScanCode;

  useEffect(() => {
    if (!scanNotice) return;
    const timer = window.setTimeout(() => setScanNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [scanNotice]);

  useEffect(() => {
    let buffer = "";
    let lastAt = 0;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isSearch = target?.dataset.posScan === "true";
      const typingElsewhere =
        !isSearch &&
        (tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          Boolean(target?.isContentEditable));
      if (typingElsewhere) return;

      if (event.key === "Enter") {
        if (buffer.length >= 4) {
          event.preventDefault();
          const code = buffer;
          buffer = "";
          applyScanRef.current(code);
          return;
        }
        if (isSearch) {
          event.preventDefault();
          applyScanRef.current((target as HTMLInputElement).value);
        }
        return;
      }
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const now = Date.now();
      if (now - lastAt > 80) buffer = "";
      lastAt = now;
      buffer += event.key;
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        setLineStaff((ls) => {
          if (!(key in ls)) return ls;
          const nextLs = { ...ls };
          delete nextLs[key];
          return nextLs;
        });
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
    setLineStaff({});
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

  const ticketNotes = [
    notes.trim(),
    !promoCode && cartDiscountReason.trim()
      ? `${t("cart.discountReasonPrefix")}: ${cartDiscountReason.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
    <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="flex min-h-0 flex-col overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 lg:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setFacet(POS_FACET_ALL);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {catalogActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{catalogActions}</div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-2 sm:flex-row sm:items-center lg:px-6">
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
              data-pos-scan="true"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
                setPendingScanSku("");
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                applyScanCode(e.currentTarget.value);
              }}
              aria-label={t("searchAria")}
            />
          </div>
          <SearchSelect
            className="w-full shrink-0 sm:w-64"
            value={categorySelectValue}
            options={categoryOptions}
            onChange={(id) => {
              setFacet(id);
              setPage(1);
            }}
            placeholder={t("filters.searchCategory")}
            noResultsLabel={t("cart.searchNoResults")}
            ariaLabel={t("filters.categoryAria")}
          />
        </div>
        <p className="px-4 pt-2 text-xs text-slate-400 lg:px-6">{t("scanHint")}</p>

        {wooGroup === "soins" && wooNav.soins.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 lg:px-6">
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
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2 lg:px-6">
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
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 lg:px-6">
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

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2 text-xs text-slate-500 lg:px-6">
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
          <div className="flex flex-wrap gap-2 px-4 pt-2 lg:px-6">
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

        {scanNotice ? (
          <p className="px-4 pt-2 text-sm text-slate-600 lg:px-6">
            {scanNotice}{" "}
            {pendingScanSku && !findCatalogItemByScanCode(catalog, pendingScanSku) ? (
              <button
                type="button"
                className="font-medium text-slate-900 underline"
                onClick={() => openCreateFromScan(pendingScanSku)}
              >
                {t("scanCreate")}
              </button>
            ) : null}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="px-4 py-8 lg:px-6">
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
            {query.trim() && looksLikeScanCode(query) ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="h-8"
                  onClick={() => openCreateFromScan(query)}
                >
                  {t("scanCreate")}
                </Button>
              </div>
            ) : null}
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
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:px-6 xl:grid-cols-4">
            {pagedItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => add(item.key)}
                className="rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-slate-400"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="mb-2 h-16 w-full rounded-md object-cover"
                  />
                ) : (
                  <div
                    className="mb-2 flex h-16 w-full items-center justify-center rounded-md text-xl"
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
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-slate-600 lg:px-6">
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

      <PosTicketPanel
        lastSale={lastSale}
        sessionOpen={sessionOpen}
        sessionPaused={sessionPaused}
        sessionPreviousDay={sessionPreviousDay}
        defaultOpeningFloatCents={defaultOpeningFloatCents}
        settings={settings}
        initialAppt={initialAppt}
        appointmentId={appointmentId}
        onSelectAppointment={(id) => {
          if (!id) {
            setAppointmentId("");
            return;
          }
          selectAppointment(id);
        }}
        carts={posCarts.carts}
        activeCartId={posCarts.activeCartId}
        onSelectCart={posCarts.switchTo}
        onAddCart={posCarts.createEmpty}
        onAbandonCart={posCarts.abandon}
        onApplied={applyPosCartSnapshot}
        cartEmpty={cartEmpty}
        cartLines={cartLines}
        priceOverrides={priceOverrides}
        priceEdits={priceEdits}
        onPriceDraft={(key, value) =>
          setPriceEdits((pe) => ({ ...pe, [key]: value }))
        }
        onCommitPrice={commitPriceEdit}
        onResetPrice={resetPrice}
        onAdd={add}
        onRemove={remove}
        expandedLineKey={expandedLineKey}
        onToggleLine={(key) =>
          setExpandedLineKey((current) => (current === key ? null : key))
        }
        lineDiscountKey={lineDiscountKey}
        lineDiscountKind={lineDiscountKind}
        lineDiscountValue={lineDiscountValue}
        onToggleLineDiscount={(key) => {
          setLineDiscountKey(lineDiscountKey === key ? null : key);
          setLineDiscountKind("percent");
          setLineDiscountValue("");
        }}
        onLineDiscountKind={setLineDiscountKind}
        onLineDiscountValue={setLineDiscountValue}
        onApplyLineDiscount={applyLineDiscount}
        lineStaff={lineStaff}
        onLineStaff={(key, id) => {
          setLineStaff((ls) => {
            const copy = { ...ls };
            if (!id) delete copy[key];
            else copy[key] = id;
            return copy;
          });
        }}
        staff={staff}
        staffId={staffId}
        onStaffId={setStaffId}
        clients={clients}
        clientId={clientId}
        onClientId={(id) => {
          setClientId(id);
          setLoyaltyRewardId("");
          setLoyaltyCreditCents(0);
          setLoyaltyPreviewCents(0);
        }}
        appointments={appointments}
        notes={notes}
        onNotes={setNotes}
        freeChargeOpen={freeChargeOpen}
        onToggleFreeCharge={() => setFreeChargeOpen((open) => !open)}
        freeChargeAmount={freeChargeAmount}
        freeChargeLabel={freeChargeLabel}
        onFreeChargeAmount={setFreeChargeAmount}
        onFreeChargeLabel={setFreeChargeLabel}
        onAddFreeCharge={addFreeCharge}
        canAddFreeCharge={Boolean(eurosToCents(freeChargeAmount))}
        onClearCart={clearCart}
        extrasOpen={ticketExtrasOpen}
        onToggleExtras={() => setTicketExtrasOpen((open) => !open)}
        promoInput={promoInput}
        promoCode={promoCode}
        promoDiscountCents={promoDiscountCents}
        promoError={promoError}
        promoPending={promoPending}
        onPromoInput={setPromoInput}
        onApplyPromo={() => void applyPromoCode()}
        onClearPromo={clearPromoCode}
        cartDiscountKind={cartDiscountKind}
        cartDiscountValue={cartDiscountValue}
        cartDiscountReason={cartDiscountReason}
        onCartDiscountKind={setCartDiscountKind}
        onCartDiscountValue={setCartDiscountValue}
        onCartDiscountReason={setCartDiscountReason}
        discountCents={discountCents}
        grossCents={grossCents}
        money={money}
        loyaltyRewardId={loyaltyRewardId}
        loyaltyCreditCents={loyaltyCreditCents}
        onLoyaltyChange={handleLoyaltyChange}
        onLoyaltyCreditChange={handleLoyaltyCreditChange}
        subtotalForLoyalty={subtotalForLoyalty}
        checkout={{
          cartJson,
          lineStaffJson: JSON.stringify(lineStaff),
          notes: ticketNotes,
          discountReason: !promoCode ? cartDiscountReason.trim() : "",
          cartDiscountEuros: (discountCents / 100).toFixed(2),
          loyaltyRewardId,
          loyaltyCreditCents,
          promoCode,
          priceOverridesJson,
          posCartId: posCarts.activeCartId,
          totals,
          stripeEnabled: Boolean(stripeEnabled),
          stripePublishableKey,
          stripeAccountId,
          disabled:
            cartEmpty ||
            sessionPaused ||
            sessionPreviousDay ||
            (requireSession && !sessionOpen) ||
            Boolean(posCarts.active?.lockedByOther) ||
            cartLines.some(
              (l) =>
                l.item?.type === "service" && !(lineStaff[l.key] || staffId),
            ),
          checkoutAction,
          checkoutPending,
          checkoutState,
          onSuccess: handleStripeSuccess,
        }}
      />
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
          defaultSku={pendingScanSku}
          onSuccess={() => {
            setProductDialogOpen(false);
            setPendingScanSku("");
            setQuery("");
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
