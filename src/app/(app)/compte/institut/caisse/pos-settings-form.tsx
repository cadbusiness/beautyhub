"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { savePosSettings, type ActionResult } from "@/app/(app)/institut/caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { PosFiscalRegime, PosSettings } from "@/lib/institut/pos-settings";
import { vatRateLabel } from "@/lib/institut/pos-settings";
import {
  POS_CURRENCIES,
  TAX_COUNTRY_CODES,
  getTaxCountry,
  isVatExemptRegime,
  suggestedVatRates,
  type TaxCountryCode,
} from "@/lib/institut/tax-catalog";

const initial: ActionResult = {};

function bpsToInput(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

const BAND_IDS = [
  "standard",
  "intermediate",
  "reduced",
  "super_reduced",
  "parking",
  "zero",
  "custom",
] as const;

function vatOptions(profile: ReturnType<typeof getTaxCountry>, currentBps: number) {
  const rates: Array<{ id: string; bps: number }> = [];
  if (!profile.rates.some((r) => r.bps === currentBps)) {
    rates.push({ id: "custom", bps: currentBps });
  }
  rates.push(...profile.rates);
  return rates;
}

function bandKey(id: string): `bands.${(typeof BAND_IDS)[number]}` {
  return BAND_IDS.includes(id as (typeof BAND_IDS)[number])
    ? `bands.${id as (typeof BAND_IDS)[number]}`
    : "bands.custom";
}

export function PosSettingsForm({ settings }: { settings: PosSettings }) {
  const t = useTranslations("institut.posSettings.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(savePosSettings, initial);
  const pm = settings.payment_methods;

  const [countryCode, setCountryCode] = useState(settings.country_code);
  const [currency, setCurrency] = useState(settings.currency);
  const [fiscalRegime, setFiscalRegime] = useState<PosFiscalRegime>(settings.fiscal_regime);
  const [defaultVat, setDefaultVat] = useState(bpsToInput(settings.default_vat_rate_bps));
  const [serviceVat, setServiceVat] = useState(bpsToInput(settings.service_vat_rate_bps));
  const [productVat, setProductVat] = useState(bpsToInput(settings.product_vat_rate_bps));

  const profile = useMemo(() => getTaxCountry(countryCode), [countryCode]);
  const exempt = isVatExemptRegime(fiscalRegime);

  function applyCountry(next: string) {
    const nextProfile = getTaxCountry(next);
    const suggested = suggestedVatRates(nextProfile);
    setCountryCode(next);
    setCurrency(nextProfile.currency);
    setFiscalRegime(nextProfile.defaultRegime);
    if (isVatExemptRegime(nextProfile.defaultRegime)) {
      setDefaultVat("0");
      setServiceVat("0");
      setProductVat("0");
      return;
    }
    setDefaultVat(bpsToInput(suggested.defaultBps));
    setServiceVat(bpsToInput(suggested.serviceBps));
    setProductVat(bpsToInput(suggested.productBps));
  }

  function applyRegime(next: PosFiscalRegime) {
    setFiscalRegime(next);
    if (isVatExemptRegime(next)) {
      setDefaultVat("0");
      setServiceVat("0");
      setProductVat("0");
    } else if (exempt) {
      const suggested = suggestedVatRates(profile);
      setDefaultVat(bpsToInput(suggested.defaultBps));
      setServiceVat(bpsToInput(suggested.serviceBps));
      setProductVat(bpsToInput(suggested.productBps));
    }
  }

  const defaultOptions = vatOptions(profile, Math.round(Number.parseFloat(defaultVat) * 100) || 0);
  const serviceOptions = vatOptions(profile, Math.round(Number.parseFloat(serviceVat) * 100) || 0);
  const productOptions = vatOptions(profile, Math.round(Number.parseFloat(productVat) * 100) || 0);

  return (
    <form action={action} className="space-y-8">
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-600">{state.message ?? t("saved")}</p>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("generalTitle")}</h3>
        <p className="text-sm text-slate-500">{t("taxIntro")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="country_code">
              {t("country")}
            </label>
            <Select
              id="country_code"
              name="country_code"
              value={countryCode}
              onChange={(e) => applyCountry(e.target.value)}
            >
              {TAX_COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`countries.${code as TaxCountryCode}`)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="currency">
              {t("currency")}
            </label>
            <Select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {POS_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {t(`currencies.${code}`)}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400">
              {t("currencyHint", { suggested: profile.currency.toUpperCase() })}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="price_display">
              {t("priceDisplay")}
            </label>
            <Select id="price_display" name="price_display" defaultValue={settings.price_display}>
              <option value="ttc">{t("priceTtc")}</option>
              <option value="ht">{t("priceHt")}</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="fiscal_regime">
              {t("fiscalRegime")}
            </label>
            <Select
              id="fiscal_regime"
              name="fiscal_regime"
              value={fiscalRegime}
              onChange={(e) => applyRegime(e.target.value as PosFiscalRegime)}
            >
              {profile.regimes.map((regime) => (
                <option key={regime} value={regime}>
                  {t(`regimes.${regime}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("vatTitle")}</h3>
        <p className="text-sm text-slate-500">
          {exempt
            ? t("vatExemptHint")
            : t("vatHint", {
                country: t(`countries.${profile.code}`),
                vat: profile.vatName,
              })}
        </p>
        {exempt ? (
          <>
            <input type="hidden" name="default_vat_rate" value="0" />
            <input type="hidden" name="service_vat_rate" value="0" />
            <input type="hidden" name="product_vat_rate" value="0" />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="default_vat_rate">
                {t("defaultVat")}
              </label>
              <Select
                id="default_vat_rate"
                name="default_vat_rate"
                value={defaultVat}
                onChange={(e) => setDefaultVat(e.target.value)}
              >
                {defaultOptions.map((rate) => (
                  <option key={`d-${rate.bps}`} value={bpsToInput(rate.bps)}>
                    {vatRateLabel(rate.bps)} · {t(bandKey(rate.id))}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="service_vat_rate">
                {t("serviceVat")}
              </label>
              <Select
                id="service_vat_rate"
                name="service_vat_rate"
                value={serviceVat}
                onChange={(e) => setServiceVat(e.target.value)}
              >
                {serviceOptions.map((rate) => (
                  <option key={`s-${rate.bps}`} value={bpsToInput(rate.bps)}>
                    {vatRateLabel(rate.bps)} · {t(bandKey(rate.id))}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500" htmlFor="product_vat_rate">
                {t("productVat")}
              </label>
              <Select
                id="product_vat_rate"
                name="product_vat_rate"
                value={productVat}
                onChange={(e) => setProductVat(e.target.value)}
              >
                {productOptions.map((rate) => (
                  <option key={`p-${rate.bps}`} value={bpsToInput(rate.bps)}>
                    {vatRateLabel(rate.bps)} · {t(bandKey(rate.id))}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("paymentsTitle")}</h3>
        <div className="flex flex-wrap gap-4">
          {(["cash", "card", "transfer", "gift_card", "stripe"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name={`pm_${key}`}
                defaultChecked={pm[key]}
                className="rounded border-slate-300"
              />
              {t(`paymentMethods.${key}`)}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("legalTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="legal_name">
              {t("legalName")}
            </label>
            <Input id="legal_name" name="legal_name" defaultValue={settings.legal_name ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="legal_address">
              {t("legalAddress")}
            </label>
            <Textarea
              id="legal_address"
              name="legal_address"
              rows={2}
              defaultValue={settings.legal_address ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="vat_number">
              {profile.vatNumberLabel}
            </label>
            <Input id="vat_number" name="vat_number" defaultValue={settings.vat_number ?? ""} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="siret">
              {profile.companyIdLabel}
            </label>
            <Input id="siret" name="siret" defaultValue={settings.siret ?? ""} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("documentsTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="ticket_prefix">
              {t("ticketPrefix")}
            </label>
            <Input
              id="ticket_prefix"
              name="ticket_prefix"
              defaultValue={settings.ticket_prefix}
              maxLength={8}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="invoice_prefix">
              {t("invoicePrefix")}
            </label>
            <Input
              id="invoice_prefix"
              name="invoice_prefix"
              defaultValue={settings.invoice_prefix}
              maxLength={8}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="delivery_note_prefix">
              {t("deliveryPrefix")}
            </label>
            <Input
              id="delivery_note_prefix"
              name="delivery_note_prefix"
              defaultValue={settings.delivery_note_prefix}
              maxLength={8}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("ticketTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="ticket_header">
              {t("ticketHeader")}
            </label>
            <Textarea
              id="ticket_header"
              name="ticket_header"
              rows={2}
              defaultValue={settings.ticket_header ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="ticket_footer">
              {t("ticketFooter")}
            </label>
            <Textarea
              id="ticket_footer"
              name="ticket_footer"
              rows={2}
              defaultValue={settings.ticket_footer ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("legalDocsTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="legal_email">
              {t("legalEmail")}
            </label>
            <Input
              id="legal_email"
              name="legal_email"
              type="email"
              defaultValue={settings.legal_email ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="payment_terms_days">
              {t("paymentTermsDays")}
            </label>
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              type="number"
              min={0}
              defaultValue={settings.payment_terms_days}
              className="w-32"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="fixed_recovery_fee">
              {t("fixedRecoveryFee")}
            </label>
            <Input
              id="fixed_recovery_fee"
              name="fixed_recovery_fee"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(settings.fixed_recovery_fee_cents / 100).toFixed(2)}
              className="w-32"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="late_payment_penalty_text">
              {t("latePaymentPenalty")}
            </label>
            <Textarea
              id="late_payment_penalty_text"
              name="late_payment_penalty_text"
              rows={2}
              defaultValue={settings.late_payment_penalty_text ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="legal_mentions">
              {t("legalMentionsOverride")}
            </label>
            <Textarea
              id="legal_mentions"
              name="legal_mentions"
              rows={4}
              placeholder={t("legalMentionsPlaceholder")}
              defaultValue={settings.legal_mentions ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("discountReasonsTitle")}</h3>
        <p className="text-xs text-slate-500">{t("discountReasonsHelp")}</p>
        <Textarea
          id="discount_reasons"
          name="discount_reasons"
          rows={5}
          defaultValue={settings.discount_reasons.join("\n")}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("sessionTitle")}</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="require_open_session"
            defaultChecked={settings.require_open_session}
            className="rounded border-slate-300"
          />
          {t("requireOpenSession")}
        </label>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="default_opening_float">
            {t("defaultOpeningFloat")}
          </label>
          <Input
            id="default_opening_float"
            name="default_opening_float"
            type="number"
            min={0}
            step="0.01"
            defaultValue={(settings.default_opening_float_cents / 100).toFixed(2)}
            className="w-32"
          />
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}
