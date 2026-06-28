"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { savePosSettings, type ActionResult } from "@/app/(app)/institut/caisse-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { PosSettings } from "@/lib/institut/pos-settings";

const initial: ActionResult = {};

function bpsToPercent(bps: number): string {
  return String(bps / 100);
}

export function PosSettingsForm({ settings }: { settings: PosSettings }) {
  const t = useTranslations("institut.posSettings.form");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(savePosSettings, initial);
  const pm = settings.payment_methods;

  return (
    <form action={action} className="space-y-8">
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-600">{state.message ?? t("saved")}</p>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("generalTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="country_code">
              {t("country")}
            </label>
            <Select id="country_code" name="country_code" defaultValue={settings.country_code}>
              <option value="FR">France</option>
              <option value="BE">Belgique</option>
              <option value="CH">Suisse</option>
              <option value="LU">Luxembourg</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="currency">
              {t("currency")}
            </label>
            <Select id="currency" name="currency" defaultValue={settings.currency}>
              <option value="eur">EUR</option>
              <option value="chf">CHF</option>
            </Select>
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
            <Select id="fiscal_regime" name="fiscal_regime" defaultValue={settings.fiscal_regime}>
              <option value="standard">{t("regimeStandard")}</option>
              <option value="nf525">{t("regimeNf525")}</option>
              <option value="be_vat">{t("regimeBeVat")}</option>
              <option value="be_gks">{t("regimeBeGks")}</option>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("vatTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="default_vat_rate">
              {t("defaultVat")}
            </label>
            <Input
              id="default_vat_rate"
              name="default_vat_rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={bpsToPercent(settings.default_vat_rate_bps)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="service_vat_rate">
              {t("serviceVat")}
            </label>
            <Input
              id="service_vat_rate"
              name="service_vat_rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={bpsToPercent(settings.service_vat_rate_bps)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="product_vat_rate">
              {t("productVat")}
            </label>
            <Input
              id="product_vat_rate"
              name="product_vat_rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={bpsToPercent(settings.product_vat_rate_bps)}
            />
          </div>
        </div>
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
              {t("vatNumber")}
            </label>
            <Input id="vat_number" name="vat_number" defaultValue={settings.vat_number ?? ""} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="siret">
              {t("siret")}
            </label>
            <Input id="siret" name="siret" defaultValue={settings.siret ?? ""} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-slate-900">{t("ticketTitle")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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
