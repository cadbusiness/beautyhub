export type SaleDocumentType = "ticket" | "invoice" | "delivery_note" | "credit_note";

export type SaleDocumentStatus =
  | "issued"
  | "partial"
  | "paid"
  | "settled"
  | "delivered"
  | "cancelled";

export type SaleDocumentLine = {
  reference: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  lineTotalCents: number;
  vatRateBps: number;
  itemType: string;
};

export type SaleDocumentPayment = {
  method: string;
  amountCents: number;
  reference: string | null;
  paidAt: string;
};

export type SaleDocumentVatRow = {
  rateLabel: string;
  baseCents: number;
  vatCents: number;
};

export type SaleDocumentPayload = {
  id: string;
  docType: SaleDocumentType;
  docNumber: string;
  saleGroupNumber: number | null;
  status: SaleDocumentStatus;
  issuedAt: string;
  saleId: string | null;
  creditNoteId: string | null;
  tenantName: string;
  legalName: string;
  legalAddress: string | null;
  vatNumber: string | null;
  companyId: string | null;
  legalEmail: string | null;
  countryCode: string;
  currency: string;
  clientName: string | null;
  clientEmail: string | null;
  staffName: string | null;
  cashSessionLabel: string | null;
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
  amountPaidCents: number;
  saleStatus: string;
  lines: SaleDocumentLine[];
  payments: SaleDocumentPayment[];
  vatRows: SaleDocumentVatRow[];
  relatedDocuments: Array<{ docType: SaleDocumentType; docNumber: string }>;
  originalInvoiceNumber: string | null;
  creditReason: string | null;
  paymentTermsDays: number;
  legalMentions: {
    paymentDiscount: string;
    latePaymentPenalty: string;
    fixedRecoveryFee: string;
    retentionOfTitle: string;
    jurisdiction: string;
  };
  vatLabel: string;
  companyIdLabel: string;
  isCredit: boolean;
};
