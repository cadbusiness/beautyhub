import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { formatPrice } from "@/lib/utils";
import type { SaleDocumentPayload } from "./types";

const PAGE_WIDTH = 280;

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte bancaire",
  stripe: "Stripe",
  transfer: "Virement",
  voucher: "Voucher",
  gift_card: "Bon-cadeau",
  credit_note: "Avoir",
  mixed: "Mixte",
  other: "Autre",
};

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 16,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  total: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  legalName: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  muted: {
    marginTop: 2,
    fontSize: 8,
    color: "#475569",
    textAlign: "center",
  },
  dashed: {
    marginVertical: 10,
    borderTopWidth: 0.6,
    borderTopColor: "#cbd5e1",
  },
  meta: {
    fontSize: 8,
    color: "#334155",
    lineHeight: 1.45,
  },
  lineRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  qty: {
    width: 18,
    fontSize: 8,
  },
  name: {
    flex: 1,
    fontSize: 8,
  },
  amount: {
    width: 58,
    textAlign: "right",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  headerRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  vatHeader: {
    flexDirection: "row",
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  vatRow: {
    flexDirection: "row",
    fontSize: 8,
    marginBottom: 2,
  },
  vatCol: {
    flex: 1,
  },
  vatColRight: {
    flex: 1,
    textAlign: "right",
  },
  thanks: {
    marginTop: 14,
    fontSize: 8,
    textAlign: "center",
    color: "#475569",
  },
});

function documentKindLabel(docType: SaleDocumentPayload["docType"]): string {
  switch (docType) {
    case "invoice":
      return "FACTURE";
    case "delivery_note":
      return "BON DE LIVRAISON";
    case "credit_note":
      return "AVOIR";
    default:
      return "TICKET";
  }
}

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

/** Helvetica/WinAnsi cannot encode NNBSP from `Intl` FR currency; that yields a broken PDF. */
function pdfSafe(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/[\u202F\u00A0\u2007\u2009\u200A\u2060]/g, " ")
    .replace(/\u2011/g, "-");
}

function pdfPrice(cents: number, currency: string): string {
  return pdfSafe(formatPrice(cents, currency, "fr-FR"));
}

function TicketPdfDocument({ payload }: { payload: SaleDocumentPayload }) {
  const locale = "fr-FR";
  const issued = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(payload.issuedAt));
  const groupSuffix = payload.saleGroupNumber ? ` / ${payload.saleGroupNumber}` : "";

  return (
    <Document title={`${documentKindLabel(payload.docType)} ${payload.docNumber}`} author={payload.legalName}>
      <Page size={{ width: PAGE_WIDTH, height: 640 }} style={styles.page} wrap>
        <Text style={styles.total}>{pdfPrice(payload.totalCents, payload.currency)}</Text>
        <Text style={styles.legalName}>{pdfSafe(payload.legalName)}</Text>
        {payload.legalAddress ? (
          <Text style={styles.muted}>{pdfSafe(payload.legalAddress)}</Text>
        ) : null}
        {payload.companyId ? (
          <Text style={styles.muted}>
            {pdfSafe(`${payload.companyIdLabel} ${payload.companyId}`)}
          </Text>
        ) : null}
        {payload.vatNumber ? (
          <Text style={styles.muted}>
            {pdfSafe(`${payload.vatLabel} ${payload.vatNumber}`)}
          </Text>
        ) : null}

        <View style={styles.dashed} />
        <Text style={styles.meta}>{documentKindLabel(payload.docType)}</Text>
        <Text style={styles.meta}>Date : {pdfSafe(issued)}</Text>
        {payload.cashSessionLabel ? (
          <Text style={styles.meta}>Caisse : {pdfSafe(payload.cashSessionLabel)}</Text>
        ) : null}
        {payload.staffName ? (
          <Text style={styles.meta}>Vendeur : {pdfSafe(payload.staffName)}</Text>
        ) : null}
        {payload.clientName ? (
          <Text style={styles.meta}>Client : {pdfSafe(payload.clientName)}</Text>
        ) : null}
        <Text style={styles.meta}>
          Notre référence : {pdfSafe(`${payload.docNumber}${groupSuffix}`)}
        </Text>
        <View style={styles.dashed} />

        <View style={styles.headerRow}>
          <Text style={styles.qty}>Qté</Text>
          <Text style={styles.name}>Désignation</Text>
          <Text style={styles.amount}>Montant TTC</Text>
        </View>
        {payload.lines.map((line, index) => (
          <View key={`${line.name}-${index}`} style={styles.lineRow} wrap={false}>
            <Text style={styles.qty}>{line.quantity}</Text>
            <Text style={styles.name}>{pdfSafe(line.name)}</Text>
            <Text style={styles.amount}>
              {pdfPrice(line.lineTotalCents, payload.currency)}
            </Text>
          </View>
        ))}

        <View style={styles.dashed} />
        {payload.discountCents > 0 ? (
          <View style={styles.totalRow}>
            <Text>Remise</Text>
            <Text>−{pdfPrice(payload.discountCents, payload.currency)}</Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text>Montant TTC</Text>
          <Text>{pdfPrice(payload.totalCents, payload.currency)}</Text>
        </View>
        <View style={styles.dashed} />

        <View style={styles.vatHeader}>
          <Text style={styles.vatCol}>Code</Text>
          <Text style={styles.vatCol}>Taux</Text>
          <Text style={styles.vatColRight}>Base HT</Text>
          <Text style={styles.vatColRight}>Montant TVA</Text>
        </View>
        {payload.vatRows.map((row, index) => (
          <View key={row.rateLabel} style={styles.vatRow} wrap={false}>
            <Text style={styles.vatCol}>{index + 1}</Text>
            <Text style={styles.vatCol}>{pdfSafe(row.rateLabel)}</Text>
            <Text style={styles.vatColRight}>
              {pdfPrice(row.baseCents, payload.currency)}
            </Text>
            <Text style={styles.vatColRight}>
              {pdfPrice(row.vatCents, payload.currency)}
            </Text>
          </View>
        ))}

        {payload.payments.length > 0 ? (
          <>
            <View style={styles.dashed} />
            {payload.payments.map((payment, index) => (
              <View key={`${payment.method}-${index}`} wrap={false}>
                <Text style={styles.meta}>
                  {methodLabel(payment.method)}{" "}
                  {pdfPrice(payment.amountCents, payload.currency)}
                </Text>
                {payment.reference ? (
                  <Text style={styles.muted}>{pdfSafe(payment.reference)}</Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.thanks}>Merci de votre visite !</Text>
      </Page>
    </Document>
  );
}

async function pdfToBuffer(instance: ReturnType<typeof pdf>): Promise<Buffer> {
  const stream = await instance.toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function renderTicketPdfBuffer(
  payload: SaleDocumentPayload,
): Promise<Buffer> {
  return pdfToBuffer(pdf(<TicketPdfDocument payload={payload} />));
}

export function ticketPdfFileName(payload: SaleDocumentPayload): string {
  const safe = payload.docNumber.replace(/[^\w.-]+/g, "_");
  return `${safe || "ticket"}.pdf`;
}

export function ticketPdfHeaders(fileName: string, byteLength?: number): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
    ...(byteLength != null ? { "Content-Length": String(byteLength) } : {}),
  };
}

export function ticketPdfResponse(buffer: Buffer, fileName: string): Response {
  return new Response(Uint8Array.from(buffer), {
    status: 200,
    headers: ticketPdfHeaders(fileName, buffer.length),
  });
}
