"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  checkoutCash,
  checkoutCardManual,
  type ActionResult,
} from "../caisse-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import {
  cartTotal,
  type PosCatalogItem,
  type PosCategory,
} from "@/lib/institut/pos";
import { StripePosPayment } from "./stripe-pos-payment";

interface Option {
  id: string;
  label: string;
}

const initial: ActionResult = {};

export function PosTerminal({
  catalog,
  clients,
  stripeEnabled,
  stripePublishableKey,
  stripeAccountId,
}: {
  catalog: PosCatalogItem[];
  clients: Option[];
  stripeEnabled?: boolean;
  stripePublishableKey?: string;
  stripeAccountId?: string;
}) {
  const t = useTranslations("pos.terminal");
  const tCommon = useTranslations("common");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<PosCategory>("all");
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cashState, cashAction, cashPending] = useActionState(checkoutCash, initial);
  const [cardState, cardAction, cardPending] = useActionState(checkoutCardManual, initial);

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

  const total = useMemo(() => cartTotal(cart, catalog), [cart, catalog]);
  const cartJson = JSON.stringify(cart);
  const cartEmpty = Object.keys(cart).length === 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (tab !== "all" && item.category !== tab) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [catalog, tab, query]);

  const cartLines = useMemo(() => {
    const byKey = new Map(catalog.map((i) => [i.key, i]));
    return Object.entries(cart)
      .map(([key, qty]) => ({ item: byKey.get(key), key, qty }))
      .filter((l) => l.item);
  }, [cart, catalog]);

  function add(key: string) {
    setMessage(null);
    setCart((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
  }

  function remove(key: string) {
    setMessage(null);
    setCart((c) => {
      const next = { ...c };
      const q = (next[key] ?? 0) - 1;
      if (q <= 0) delete next[key];
      else next[key] = q;
      return next;
    });
  }

  function clearCart() {
    setCart({});
    setMessage(null);
  }

  function handleSuccess(msg: string) {
    setCart({});
    setMessage(msg);
  }

  const actionError = cashState.error ?? cardState.error;
  const actionOk = cashState.ok ? cashState.message : cardState.ok ? cardState.message : null;
  const pending = cashPending || cardPending;

  const showStripe =
    stripeEnabled &&
    stripePublishableKey &&
    stripeAccountId &&
    !cartEmpty;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
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

        <Input
          placeholder={t("searchArticles")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("searchAria")}
        />

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">{t("emptyCategory")}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
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
                  {categoryLabel[item.category]}
                </span>
                <p className="line-clamp-2 text-sm font-medium text-slate-900">
                  {item.name}
                </p>
                <p className="text-sm text-slate-500">
                  {formatPrice(item.price_cents)}
                  {item.duration_min ? ` · ${item.duration_min} min` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit space-y-4 lg:sticky lg:top-4">
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
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {cartLines.map(({ item, key, qty }) =>
              item ? (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {item.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => remove(key)}
                      className="h-7 w-7 rounded text-slate-500 hover:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{qty}</span>
                    <button
                      type="button"
                      onClick={() => add(key)}
                      className="h-7 w-7 rounded text-slate-500 hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm text-slate-500">{t("cart.total")}</span>
          <span className="text-xl font-semibold text-slate-900">
            {formatPrice(total)}
          </span>
        </div>

        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        {actionOk && !message ? <p className="text-sm text-green-600">{actionOk}</p> : null}

        <Select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
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

        <form action={cashAction} className="space-y-2">
          <input type="hidden" name="cart" value={cartJson} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="notes" value={notes} />
          <Button
            type="submit"
            className="w-full"
            disabled={pending || cartEmpty}
            onClick={() => setMessage(null)}
          >
            {cashPending
              ? t("checkout.cashPending")
              : t("checkout.cash", { total: formatPrice(total) })}
          </Button>
        </form>

        <form action={cardAction}>
          <input type="hidden" name="cart" value={cartJson} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="notes" value={notes} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={pending || cartEmpty}
            onClick={() => setMessage(null)}
          >
            {cardPending
              ? t("checkout.cardPending")
              : t("checkout.card", { total: formatPrice(total) })}
          </Button>
        </form>

        {showStripe ? (
          <StripePosPayment
            cartJson={cartJson}
            clientId={clientId}
            totalCents={total}
            clients={clients}
            publishableKey={stripePublishableKey}
            stripeAccountId={stripeAccountId}
            disabled={cartEmpty}
            onSuccess={handleSuccess}
          />
        ) : null}
      </Card>
    </div>
  );
}
