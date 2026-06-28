"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitPublicQuoteRequest } from "./actions";
import type { PublicService } from "@/lib/public/booking-load";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

export function QuoteRequestForm({
  service,
  onBack,
}: {
  service: PublicService;
  onBack: () => void;
}) {
  const t = useTranslations("public.booking.quoteRequest");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitPublicQuoteRequest({
        serviceId: service.id,
        email,
        fullName,
        phone: phone || undefined,
        message: message || undefined,
        eventDate: eventDate || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">{t("successTitle")}</p>
        <p className="text-sm text-slate-600">{t("successHint")}</p>
        <Button variant="outline" onClick={onBack}>
          {t("backToServices")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">{service.name}</p>
        {service.price_cents > 0 ? (
          <p className="text-sm text-slate-600">
            {t("fromPrice", { price: formatPrice(service.price_cents) })}
          </p>
        ) : null}
        {service.description ? (
          <p className="mt-2 text-sm text-slate-600">{service.description}</p>
        ) : null}
      </div>

      <Field label={tCommon("email")} htmlFor="quote_email">
        <Input
          id="quote_email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label={t("fullName")} htmlFor="quote_name">
        <Input
          id="quote_name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </Field>
      <Field label={tCommon("phone")} htmlFor="quote_phone">
        <Input
          id="quote_phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label={t("eventDate")} htmlFor="quote_event_date">
        <Input
          id="quote_event_date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </Field>
      <Field label={t("message")} htmlFor="quote_message">
        <Textarea
          id="quote_message"
          rows={4}
          placeholder={t("messagePlaceholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" onClick={onBack}>
          {tCommon("back")}
        </Button>
        <Button type="button" disabled={pending || !email || !fullName} onClick={submit}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </Card>
  );
}
