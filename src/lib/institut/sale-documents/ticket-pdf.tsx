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
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    borderStyle: "dashed",
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

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

function TicketPdfDocument({ payload }: { payload: SaleDocumentPayload }) {
  const locale = "fr-FR";
  const issued = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(payload.issuedAt));
  const groupSuffix = payload.saleGroupNumber ? ` / ${payload.saleGroupNumber}` : "";

  return (
    <Document title={`Ticket ${payload.docNumber}`} author={payload.legalName}>
      <Page size={{ width: PAGE_WIDTH, height: 640 }} style={styles.page} wrap>
        <Text style={styles.total}>
          {formatPrice(payload.totalCents, payload.currency, locale)}
        </Text>
        <Text style={styles.legalName}>{payload.legalName}</Text>
        {payload.legalAddress ? (
          <Text style={styles.muted}>{payload.legalAddress}</Text>
        ) : null}
        {payload.companyId ? (
          <Text style={styles.muted}>
            {payload.companyIdLabel} {payload.companyId}
          </Text>
        ) : null}
        {payload.vatNumber ? (
          <Text style={styles.muted}>
            {payload.vatLabel} {payload.vatNumber}
          </Text>
        ) : null}

        <View style={styles.dashed} />
        <Text style={styles.meta}>VENTE</Text>
        <Text style={styles.meta}>Date : {issued}</Text>
        {payload.cashSessionLabel ? (
          <Text style={styles.meta}>Caisse : {payload.cashSessionLabel}</Text>
        ) : null}
        {payload.staffName ? (
          <Text style={styles.meta}>Vendeur : {payload.staffName}</Text>
        ) : null}
        {payload.clientName ? (
          <Text style={styles.meta}>Client : {payload.clientName}</Text>
        ) : null}
        <Text style={styles.meta}>
          Notre référence : {payload.docNumber}
          {groupSuffix}
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
            <Text style={styles.name}>{line.name}</Text>
            <Text style={styles.amount}>
              {formatPrice(line.lineTotalCents, payload.currency, locale)}
            </Text>
          </View>
        ))}

        <View style={styles.dashed} />
        <View style={styles.totalRow}>
          <Text>Montant TTC</Text>
          <Text>{formatPrice(payload.totalCents, payload.currency, locale)}</Text>
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
            <Text style={styles.vatCol}>{row.rateLabel}</Text>
            <Text style={styles.vatColRight}>
              {formatPrice(row.baseCents, payload.currency, locale)}
            </Text>
            <Text style={styles.vatColRight}>
              {formatPrice(row.vatCents, payload.currency, locale)}
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
                  {formatPrice(payment.amountCents, payload.currency, locale)}
                </Text>
                {payment.reference ? (
                  <Text style={styles.muted}>{payment.reference}</Text>
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
  if (typeof instance.toBlob === "function") {
    try {
      const blob = await instance.toBlob();
      return Buffer.from(await blob.arrayBuffer());
    } catch {
      // fall through to stream
    }
  }
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

export function ticketPdfHeaders(fileName: string): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
  };
}
