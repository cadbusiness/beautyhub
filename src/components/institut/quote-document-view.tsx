import { formatPrice } from "@/lib/utils";
import type { DocumentTemplateId, PublicQuoteView } from "@/lib/institut/commercial-documents";
import { cn } from "@/lib/utils";

const TEMPLATE_STYLES: Record<
  DocumentTemplateId,
  { header: string; accent: string; font: string }
> = {
  elegant: {
    header: "border-b-2 border-double pb-6",
    accent: "font-serif tracking-wide",
    font: "font-serif",
  },
  minimal: {
    header: "border-b pb-4",
    accent: "font-sans uppercase tracking-[0.2em] text-xs",
    font: "font-sans",
  },
  wedding: {
    header: "border-b border-rose-200 pb-6",
    accent: "font-serif italic text-rose-900",
    font: "font-serif",
  },
  artist: {
    header: "border-b-4 pb-5",
    accent: "font-sans font-bold uppercase tracking-widest text-sm",
    font: "font-sans",
  },
};

function formatDateLabel(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function QuoteDocumentView({
  quote,
  displayName,
  primaryColor,
  logoUrl,
  docTitle,
  labels,
  showActions,
  actions,
  className,
}: {
  quote: PublicQuoteView;
  displayName: string;
  primaryColor: string;
  logoUrl: string | null;
  docTitle: string;
  labels: {
    quoteNumber: string;
    validUntil: string;
    eventDate: string;
    client: string;
    service: string;
    description: string;
    quantity: string;
    unitPrice: string;
    subtotal: string;
    discount: string;
    total: string;
    message: string;
    footer: string;
  };
  showActions?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const template = TEMPLATE_STYLES[quote.template_id] ?? TEMPLATE_STYLES.elegant;
  const validUntil = formatDateLabel(quote.valid_until);
  const eventDate = formatDateLabel(quote.event_date);
  const legalName = quote.legal.legal_name ?? displayName;

  return (
    <article
      className={cn(
        "mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0",
        template.font,
        className,
      )}
    >
      <header className={cn("mb-8 flex items-start justify-between gap-6", template.header)}>
        <div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mb-4 h-12 w-auto object-contain" />
          ) : null}
          <p className={cn("text-2xl text-slate-900", template.accent)} style={{ color: primaryColor }}>
            {docTitle}
          </p>
          {quote.doc_number ? (
            <p className="mt-1 text-sm text-slate-500">
              {labels.quoteNumber} {quote.doc_number}
            </p>
          ) : null}
        </div>
        <div className="text-right text-sm text-slate-600">
          <p className="font-medium text-slate-900">{legalName}</p>
          {quote.legal.legal_address ? (
            <p className="mt-1 whitespace-pre-line">{quote.legal.legal_address}</p>
          ) : null}
          {quote.legal.siret ? <p className="mt-1">SIRET {quote.legal.siret}</p> : null}
          {quote.legal.vat_number ? <p>TVA {quote.legal.vat_number}</p> : null}
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{labels.client}</p>
          <p className="mt-1 font-medium text-slate-900">{quote.client.full_name ?? quote.client.email}</p>
          <p className="text-sm text-slate-600">{quote.client.email}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {validUntil ? (
            <p>
              <span className="font-medium text-slate-900">{labels.validUntil}</span> {validUntil}
            </p>
          ) : null}
          {eventDate ? (
            <p className={validUntil ? "mt-2" : ""}>
              <span className="font-medium text-slate-900">{labels.eventDate}</span> {eventDate}
            </p>
          ) : null}
          {quote.service?.name ? (
            <p className="mt-2">
              <span className="font-medium text-slate-900">{labels.service}</span> {quote.service.name}
            </p>
          ) : null}
        </div>
      </section>

      {quote.client_message ? (
        <section className="mb-8 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{labels.message}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{quote.client_message}</p>
        </section>
      ) : null}

      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-2 pr-4">{labels.description}</th>
            <th className="pb-2 pr-4 text-right">{labels.quantity}</th>
            <th className="pb-2 pr-4 text-right">{labels.unitPrice}</th>
            <th className="pb-2 text-right">{labels.total}</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line, index) => (
            <tr key={`${line.label}-${index}`} className="border-b border-slate-100">
              <td className="py-3 pr-4">
                <p className="font-medium text-slate-900">{line.label}</p>
                {line.description ? (
                  <p className="mt-0.5 text-xs text-slate-500">{line.description}</p>
                ) : null}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{line.quantity}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-slate-700">
                {formatPrice(line.unit_price_cents)}
              </td>
              <td className="py-3 text-right tabular-nums font-medium text-slate-900">
                {formatPrice(Math.round(line.quantity * line.unit_price_cents))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>{labels.subtotal}</span>
          <span className="tabular-nums">{formatPrice(quote.subtotal_cents)}</span>
        </div>
        {quote.discount_cents > 0 ? (
          <div className="flex justify-between text-slate-600">
            <span>{labels.discount}</span>
            <span className="tabular-nums">−{formatPrice(quote.discount_cents)}</span>
          </div>
        ) : null}
        <div
          className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"
          style={{ color: primaryColor }}
        >
          <span>{labels.total}</span>
          <span className="tabular-nums">{formatPrice(quote.total_cents)}</span>
        </div>
      </div>

      {showActions && actions ? (
        <div className="mt-8 border-t border-slate-200 pt-6 print:hidden">{actions}</div>
      ) : null}

      <footer className="mt-10 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 print:mt-16">
        {labels.footer.replace("{name}", displayName)}
      </footer>
    </article>
  );
}
