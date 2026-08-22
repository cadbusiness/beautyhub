"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import type { ActionResult } from "../caisse-actions";
import type { PosAppointmentOption } from "@/lib/institut/pos-appointment";
import type { PosCatalogItem } from "@/lib/institut/pos";
import type { PosSettings } from "@/lib/institut/pos-settings";
import { CheckoutPanel } from "./checkout-panel";
import { PosCartSwitcher } from "./pos-cart-switcher";
import { PosLoyaltyPicker } from "./pos-loyalty-picker";
import { OpenSessionForm } from "./session/open-session-form";
import type { PosCartDto } from "@/lib/institut/pos-cart-types";
import type { PosCartLocalState } from "./use-pos-carts";

type Option = { id: string; label: string };

const LINE_GRID =
  "grid grid-cols-[4.75rem_minmax(0,1fr)_4.25rem_4.75rem] items-center gap-x-2";

export function PosTicketPanel({
  lastSale,
  sessionOpen,
  sessionPaused,
  sessionPreviousDay,
  defaultOpeningFloatCents,
  settings,
  initialAppt,
  appointmentId,
  onSelectAppointment,
  carts,
  activeCartId,
  onSelectCart,
  onAddCart,
  onAbandonCart,
  onApplied,
  cartEmpty,
  cartLines,
  priceOverrides,
  priceEdits,
  onPriceDraft,
  onCommitPrice,
  onResetPrice,
  onAdd,
  onRemove,
  expandedLineKey,
  onToggleLine,
  lineDiscountKey,
  lineDiscountKind,
  lineDiscountValue,
  onToggleLineDiscount,
  onLineDiscountKind,
  onLineDiscountValue,
  onApplyLineDiscount,
  lineStaff,
  onLineStaff,
  staff,
  staffId,
  onStaffId,
  clients,
  clientId,
  onClientId,
  appointments,
  notes,
  onNotes,
  freeChargeOpen,
  onToggleFreeCharge,
  freeChargeAmount,
  freeChargeLabel,
  onFreeChargeAmount,
  onFreeChargeLabel,
  onAddFreeCharge,
  canAddFreeCharge,
  onClearCart,
  extrasOpen,
  onToggleExtras,
  promoInput,
  promoCode,
  promoDiscountCents,
  promoError,
  promoPending,
  onPromoInput,
  onApplyPromo,
  onClearPromo,
  cartDiscountKind,
  cartDiscountValue,
  cartDiscountReason,
  onCartDiscountKind,
  onCartDiscountValue,
  onCartDiscountReason,
  discountCents,
  grossCents,
  money,
  loyaltyRewardId,
  loyaltyCreditCents,
  onLoyaltyChange,
  onLoyaltyCreditChange,
  subtotalForLoyalty,
  checkout,
}: {
  lastSale: ActionResult | null;
  sessionOpen: boolean;
  sessionPaused: boolean;
  sessionPreviousDay: boolean;
  defaultOpeningFloatCents: number;
  settings: PosSettings;
  initialAppt?: PosAppointmentOption;
  appointmentId: string;
  onSelectAppointment: (id: string) => void;
  carts: PosCartDto[];
  activeCartId: string | null;
  onSelectCart: (id: string, force?: boolean) => Promise<PosCartLocalState | null>;
  onAddCart: () => Promise<PosCartLocalState | null>;
  onAbandonCart: (id: string, force?: boolean) => Promise<PosCartLocalState | null>;
  onApplied: (next: PosCartLocalState) => void;
  cartEmpty: boolean;
  cartLines: { item: PosCatalogItem | null; key: string; qty: number }[];
  priceOverrides: Record<string, number>;
  priceEdits: Record<string, string>;
  onPriceDraft: (key: string, value: string) => void;
  onCommitPrice: (key: string, defaultCents: number) => void;
  onResetPrice: (key: string) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  expandedLineKey: string | null;
  onToggleLine: (key: string) => void;
  lineDiscountKey: string | null;
  lineDiscountKind: "percent" | "fixed";
  lineDiscountValue: string;
  onToggleLineDiscount: (key: string) => void;
  onLineDiscountKind: (kind: "percent" | "fixed") => void;
  onLineDiscountValue: (value: string) => void;
  onApplyLineDiscount: (key: string, catalogCents: number) => void;
  lineStaff: Record<string, string>;
  onLineStaff: (key: string, staffId: string) => void;
  staff: Option[];
  staffId: string;
  onStaffId: (id: string) => void;
  clients: Option[];
  clientId: string;
  onClientId: (id: string) => void;
  appointments: PosAppointmentOption[];
  notes: string;
  onNotes: (value: string) => void;
  freeChargeOpen: boolean;
  onToggleFreeCharge: () => void;
  freeChargeAmount: string;
  freeChargeLabel: string;
  onFreeChargeAmount: (value: string) => void;
  onFreeChargeLabel: (value: string) => void;
  onAddFreeCharge: () => void;
  canAddFreeCharge: boolean;
  onClearCart: () => void;
  extrasOpen: boolean;
  onToggleExtras: () => void;
  promoInput: string;
  promoCode: string;
  promoDiscountCents: number;
  promoError: string | null;
  promoPending: boolean;
  onPromoInput: (value: string) => void;
  onApplyPromo: () => void;
  onClearPromo: () => void;
  cartDiscountKind: "percent" | "fixed";
  cartDiscountValue: string;
  cartDiscountReason: string;
  onCartDiscountKind: (kind: "percent" | "fixed") => void;
  onCartDiscountValue: (value: string) => void;
  onCartDiscountReason: (value: string) => void;
  discountCents: number;
  grossCents: number;
  money: (cents: number) => string;
  loyaltyRewardId: string;
  loyaltyCreditCents: number;
  onLoyaltyChange: (rewardId: string, discountCents: number) => void;
  onLoyaltyCreditChange: (creditCents: number) => void;
  subtotalForLoyalty: number;
  checkout: {
    cartJson: string;
    lineStaffJson: string;
    notes: string;
    discountReason: string;
    cartDiscountEuros: string;
    loyaltyRewardId: string;
    loyaltyCreditCents: number;
    promoCode: string;
    priceOverridesJson: string;
    posCartId: string | null;
    totals: {
      subtotal_cents: number;
      vat_cents: number;
      total_cents: number;
      cart_discount_cents: number;
    };
    stripeEnabled: boolean;
    stripePublishableKey?: string;
    stripeAccountId?: string;
    disabled: boolean;
    checkoutAction: (formData: FormData) => void;
    checkoutPending: boolean;
    checkoutState: ActionResult;
    onSuccess: (message: string) => void;
  };
}) {
  const t = useTranslations("pos.terminal");
  const tCheckout = useTranslations("pos.checkout");
  const missingStaff = cartLines.some(
    (l) => l.item?.type === "service" && !(lineStaff[l.key] || staffId),
  );

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
      <div className="shrink-0 space-y-2.5 border-b border-slate-200 px-3 py-3">
        {lastSale?.ok && lastSale.saleId ? (
          <div className="rounded-md bg-green-50 px-2.5 py-2 text-xs text-green-800">
            <p>{lastSale.message}</p>
            <Link
              href={`/institut/caisse/ticket/${lastSale.saleId}`}
              className="mt-0.5 inline-block underline"
              target="_blank"
            >
              {tCheckout("viewTicket")}
            </Link>
          </div>
        ) : null}

        {!sessionOpen ? (
          <div className="space-y-2 rounded-md bg-amber-50 px-2.5 py-2">
            <p className="text-sm font-medium text-amber-950">{t("sessionClosedTitle")}</p>
            <p className="text-xs text-amber-900/80">{t("sessionClosedBody")}</p>
            <OpenSessionForm
              defaultFloat={defaultOpeningFloatCents}
              currency={settings.currency}
              compact
            />
          </div>
        ) : sessionPaused ? (
          <SessionBanner
            title={t("sessionPausedTitle")}
            body={t("sessionPausedBody")}
            href="/institut/caisse/session"
            cta={t("sessionPausedCta")}
          />
        ) : sessionPreviousDay ? (
          <SessionBanner
            title={t("sessionPreviousDayTitle")}
            body={t("sessionPreviousDayBody")}
            href="/institut/caisse/session"
            cta={t("sessionPreviousDayCta")}
          />
        ) : null}

        {initialAppt && appointmentId === initialAppt.id ? (
          <p className="truncate text-xs text-slate-500">
            {t("appointmentLinked")} · {initialAppt.label}
          </p>
        ) : null}

        <PosCartSwitcher
          carts={carts}
          activeCartId={activeCartId}
          onSelect={onSelectCart}
          onAdd={onAddCart}
          onAbandon={onAbandonCart}
          onApplied={onApplied}
        />

        <SearchSelect
          value={clientId}
          options={clients}
          onChange={onClientId}
          placeholder={t("cart.searchClient")}
          emptyLabel={t("cart.noClient")}
          noResultsLabel={t("cart.searchNoResults")}
          ariaLabel={t("cart.clientAria")}
        />
        <SearchSelect
          value={staffId}
          options={staff}
          onChange={onStaffId}
          placeholder={t("cart.searchStaff")}
          emptyLabel={t("cart.noStaff")}
          noResultsLabel={t("cart.searchNoResults")}
          ariaLabel={t("cart.staffAria")}
        />
        <SearchSelect
          value={appointmentId}
          options={appointments.map((a) => ({ id: a.id, label: a.label }))}
          onChange={(id) => {
            if (!id) {
              onSelectAppointment("");
              return;
            }
            onSelectAppointment(id);
          }}
          placeholder={t("cart.searchAppointment")}
          emptyLabel={t("cart.noAppointment")}
          noResultsLabel={t("cart.searchNoResults")}
          ariaLabel={t("cart.appointmentAria")}
        />
        {missingStaff ? (
          <p className="text-xs text-amber-800">{t("cart.staffRequiredHint")}</p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("cart.title")}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleFreeCharge}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
            >
              {t("cart.freeCharge")}
            </button>
            {!cartEmpty ? (
              <button
                type="button"
                onClick={onClearCart}
                className="text-[11px] text-slate-400 hover:text-slate-700"
              >
                {t("cart.clear")}
              </button>
            ) : null}
          </div>
        </div>

        {freeChargeOpen ? (
          <div className="shrink-0 space-y-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="decimal"
                className="h-8"
                placeholder={t("cart.freeChargeAmount")}
                value={freeChargeAmount}
                onChange={(e) => onFreeChargeAmount(e.target.value)}
              />
              <Input
                className="h-8"
                placeholder={t("cart.freeChargeLabel")}
                value={freeChargeLabel}
                onChange={(e) => onFreeChargeLabel(e.target.value)}
              />
            </div>
            <Button
              type="button"
              className="h-8 w-full"
              disabled={!canAddFreeCharge}
              onClick={onAddFreeCharge}
            >
              {t("cart.freeChargeAdd")}
            </Button>
          </div>
        ) : null}

        {cartLines.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">{t("cart.empty")}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={`${LINE_GRID} border-b border-slate-100 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400`}
            >
              <span>{t("cart.colQty")}</span>
              <span>{t("cart.colItem")}</span>
              <span className="text-right">{t("cart.colPrice")}</span>
              <span className="text-right">{t("cart.colTotal")}</span>
            </div>
            <ul>
              {cartLines.map(({ item, key, qty }) => {
                if (!item) return null;
                const defaultCents = item.price_cents;
                const currentCents = priceOverrides[key] ?? defaultCents;
                const overridden = key in priceOverrides;
                const editValue = priceEdits[key] ?? (currentCents / 100).toFixed(2);
                const expanded = expandedLineKey === key;
                return (
                  <li key={key} className="border-b border-slate-100">
                    <div className={`${LINE_GRID} px-3 py-1.5`}>
                      <div className="flex h-7 items-center rounded-md border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => onRemove(key)}
                          className="h-7 w-7 text-slate-500 hover:text-slate-900"
                          aria-label={t("cart.qtyDecrease")}
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => onAdd(key)}
                          className="h-7 w-7 text-slate-500 hover:text-slate-900"
                          aria-label={t("cart.qtyIncrease")}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleLine(key)}
                        className="min-w-0 text-left"
                      >
                        <span className="block truncate text-sm text-slate-800">{item.name}</span>
                        {item.visibility === "extra_only" ? (
                          <span className="text-[10px] font-medium uppercase text-violet-600">
                            {t("cart.extraBadge")}
                          </span>
                        ) : overridden ? (
                          <span className="text-[10px] text-violet-700">
                            {t("cart.lineDiscountApplied", {
                              amount: money(Math.max(0, defaultCents - currentCents)),
                            })}
                          </span>
                        ) : null}
                      </button>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={editValue}
                          onChange={(e) => onPriceDraft(key, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => onCommitPrice(key, defaultCents)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              onPriceDraft(key, (currentCents / 100).toFixed(2));
                              e.currentTarget.blur();
                            }
                          }}
                          aria-label={t("cart.unitPriceAria")}
                          className={`h-7 w-full rounded-md border bg-white px-1.5 text-right text-xs tabular-nums text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${
                            overridden ? "border-violet-300" : "border-slate-200"
                          }`}
                        />
                      </div>
                      <span className="text-right text-xs font-medium tabular-nums text-slate-900">
                        {money(currentCents * qty)}
                      </span>
                    </div>
                    {expanded ? (
                      <div className="space-y-2 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {overridden ? (
                            <button
                              type="button"
                              onClick={() => onResetPrice(key)}
                              className="text-[11px] text-slate-500 underline decoration-dotted hover:text-slate-700"
                            >
                              {t("cart.resetPrice")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onToggleLineDiscount(key)}
                            className="text-[11px] font-medium text-slate-600 underline decoration-dotted hover:text-slate-900"
                          >
                            {t("cart.lineDiscount")}
                          </button>
                        </div>
                        {item.type === "service" ? (
                          <SearchSelect
                            size="sm"
                            value={lineStaff[key] ?? ""}
                            options={staff}
                            onChange={(id) => onLineStaff(key, id)}
                            placeholder={t("cart.searchStaff")}
                            emptyLabel={t("cart.lineStaffInherit")}
                            noResultsLabel={t("cart.searchNoResults")}
                            ariaLabel={t("cart.lineStaff")}
                          />
                        ) : null}
                        {lineDiscountKey === key ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={lineDiscountKind}
                              onChange={(e) =>
                                onLineDiscountKind(
                                  e.target.value === "fixed" ? "fixed" : "percent",
                                )
                              }
                              className="h-8 w-20 text-xs"
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
                              onChange={(e) => onLineDiscountValue(e.target.value)}
                              aria-label={t("cart.lineDiscountValue")}
                            />
                            <button
                              type="button"
                              onClick={() => onApplyLineDiscount(key, defaultCents)}
                              className="h-8 rounded-md bg-slate-900 px-2.5 text-[11px] font-medium text-white"
                            >
                              {t("cart.lineDiscountApply")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="max-h-[48%] shrink-0 overflow-y-auto border-t border-slate-200">
        {!cartEmpty ? (
          <div className="border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={onToggleExtras}
              className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              <span>{t("cart.discountAdd")}</span>
              <span className="font-medium normal-case tracking-normal text-slate-400">
                {promoCode || discountCents > 0
                  ? t("cart.discountApplied", {
                      amount: money(discountCents + promoDiscountCents),
                      total: money(Math.max(0, grossCents - discountCents - promoDiscountCents)),
                    })
                  : extrasOpen
                    ? "−"
                    : "+"}
              </span>
            </button>
            {extrasOpen ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="promo-code"
                    value={promoInput}
                    onChange={(e) => onPromoInput(e.target.value.toUpperCase())}
                    placeholder={t("cart.promoPlaceholder")}
                    className="h-8 uppercase"
                    disabled={Boolean(promoCode)}
                    aria-label={t("cart.promoCode")}
                  />
                  {promoCode ? (
                    <button
                      type="button"
                      onClick={onClearPromo}
                      className="h-8 shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {t("cart.promoClear")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onApplyPromo}
                      disabled={promoPending || !promoInput.trim()}
                      className="h-8 shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
                    <div className="flex gap-2">
                      <Select
                        value={cartDiscountKind}
                        onChange={(e) =>
                          onCartDiscountKind(e.target.value === "fixed" ? "fixed" : "percent")
                        }
                        className="h-8"
                        aria-label={t("cart.discountType")}
                      >
                        <option value="percent">{t("cart.discountPercent")}</option>
                        <option value="fixed">{t("cart.discountFixed")}</option>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step={cartDiscountKind === "percent" ? "1" : "0.01"}
                        max={
                          cartDiscountKind === "percent" ? "100" : (grossCents / 100).toFixed(2)
                        }
                        value={cartDiscountValue}
                        onChange={(e) => onCartDiscountValue(e.target.value)}
                        placeholder={cartDiscountKind === "percent" ? "10" : "15"}
                        className="h-8"
                        aria-label={t("cart.discountValue")}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {settings.discount_reasons.map((reason) => {
                        const selected = cartDiscountReason === reason;
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => onCartDiscountReason(selected ? "" : reason)}
                            className={
                              selected
                                ? "rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-white"
                                : "rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-slate-300"
                            }
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      className="h-8"
                      value={
                        settings.discount_reasons.includes(cartDiscountReason)
                          ? ""
                          : cartDiscountReason
                      }
                      onChange={(e) => onCartDiscountReason(e.target.value)}
                      placeholder={t("cart.discountReasonOther")}
                      aria-label={t("cart.discountReason")}
                    />
                  </>
                ) : null}
                <Textarea
                  value={notes}
                  onChange={(e) => onNotes(e.target.value)}
                  placeholder={t("cart.notePlaceholder")}
                  rows={2}
                  className="min-h-16 text-sm"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {clientId ? (
          <div className="px-3">
            <PosLoyaltyPicker
              clientId={clientId}
              subtotalCents={cartEmpty ? 0 : subtotalForLoyalty}
              selectedRewardId={loyaltyRewardId}
              selectedCreditCents={loyaltyCreditCents}
              onRewardChange={onLoyaltyChange}
              onCreditChange={onLoyaltyCreditChange}
              currency={settings.currency}
            />
          </div>
        ) : null}

        {!cartEmpty ? (
          <div className="px-3 pb-3">
            <CheckoutPanel
              cartJson={checkout.cartJson}
              clientId={clientId}
              staffId={staffId}
              lineStaffJson={checkout.lineStaffJson}
              appointmentId={appointmentId}
              notes={checkout.notes}
              discountReason={checkout.discountReason}
              cartDiscountEuros={checkout.cartDiscountEuros}
              loyaltyRewardId={checkout.loyaltyRewardId}
              loyaltyCreditCents={checkout.loyaltyCreditCents}
              promoCode={checkout.promoCode}
              priceOverridesJson={checkout.priceOverridesJson}
              posCartId={checkout.posCartId}
              totals={checkout.totals}
              settings={settings}
              stripeEnabled={checkout.stripeEnabled}
              stripePublishableKey={checkout.stripePublishableKey}
              stripeAccountId={checkout.stripeAccountId}
              disabled={checkout.disabled}
              checkoutAction={checkout.checkoutAction}
              checkoutPending={checkout.checkoutPending}
              checkoutState={checkout.checkoutState}
              onSuccess={checkout.onSuccess}
            />
          </div>
        ) : (
          <p className="px-3 py-3 text-sm text-slate-400">{t("cart.addToCheckout")}</p>
        )}
      </div>
    </aside>
  );
}

function SessionBanner({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-md bg-amber-50 px-2.5 py-2">
      <p className="text-sm font-medium text-amber-950">{title}</p>
      <p className="mt-0.5 text-xs text-amber-900/80">{body}</p>
      <Link
        href={href}
        className="mt-2 inline-flex h-8 items-center rounded-lg bg-amber-900 px-3 text-xs font-medium text-white hover:bg-amber-950"
      >
        {cta}
      </Link>
    </div>
  );
}

