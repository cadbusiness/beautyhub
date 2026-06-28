"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { respondToPublicQuote } from "../actions";
import type { PublicQuoteView } from "@/lib/institut/commercial-documents";
import { QuoteDocumentView } from "@/components/institut/quote-document-view";
import { Button } from "@/components/ui/button";

export function PublicQuotePageClient({
  token,
  quote,
  displayName,
  primaryColor,
  logoUrl,
}: {
  token: string;
  quote: PublicQuoteView;
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
}) {
  const t = useTranslations("public.quote");
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labels = {
    quoteNumber: t("quoteNumber"),
    validUntil: t("validUntil"),
    eventDate: t("eventDate"),
    client: t("client"),
    service: t("service"),
    description: t("description"),
    quantity: t("quantity"),
    unitPrice: t("unitPrice"),
    subtotal: t("subtotal"),
    discount: t("discount"),
    total: t("total"),
    message: t("message"),
    footer: t("footer"),
  };

  function respond(action: "accept" | "decline") {
    setError(null);
    startTransition(async () => {
      const result = await respondToPublicQuote(token, action);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(action === "accept" ? "accepted" : "declined");
    });
  }

  const statusBanner =
    status === "accepted"
      ? t("statusAccepted")
      : status === "declined"
        ? t("statusDeclined")
        : status === "expired"
          ? t("statusExpired")
          : null;

  return (
    <div className="space-y-4 py-8">
      {statusBanner ? (
        <p
          className={`mx-auto max-w-2xl rounded-lg px-4 py-3 text-center text-sm font-medium ${
            status === "accepted"
              ? "bg-emerald-50 text-emerald-800"
              : status === "declined"
                ? "bg-slate-100 text-slate-700"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {statusBanner}
        </p>
      ) : null}

      <QuoteDocumentView
        quote={{ ...quote, status }}
        displayName={displayName}
        primaryColor={primaryColor}
        logoUrl={logoUrl}
        docTitle={t("title")}
        labels={labels}
        showActions={status === "sent"}
        actions={
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => respond("decline")}
              className="min-w-40"
            >
              {t("decline")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => respond("accept")}
              className="min-w-40"
              style={{ backgroundColor: primaryColor }}
            >
              {pending ? t("responding") : t("accept")}
            </Button>
            {error ? <p className="w-full text-center text-sm text-red-600">{error}</p> : null}
          </div>
        }
      />

      <div className="mx-auto max-w-2xl text-center print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          {t("printPdf")}
        </Button>
      </div>
    </div>
  );
}
