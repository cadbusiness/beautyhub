import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getPosSettings, vatRateLabel } from "@/lib/institut/pos-settings";
import { getCompanyIdLabel, getLegalMentions, getVatLabel } from "./legal-mentions";
import type { SaleDocumentPayload, SaleDocumentVatRow } from "./types";

type Db = SupabaseClient<Database>;

function buildVatRows(
  lines: Array<{ vatRateBps: number; lineSubtotalCents: number; lineVatCents: number }>,
): SaleDocumentVatRow[] {
  const map = new Map<number, { baseCents: number; vatCents: number }>();
  for (const line of lines) {
    const current = map.get(line.vatRateBps) ?? { baseCents: 0, vatCents: 0 };
    current.baseCents += line.lineSubtotalCents;
    current.vatCents += line.lineVatCents;
    map.set(line.vatRateBps, current);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bps, totals]) => ({
      rateLabel: vatRateLabel(bps),
      baseCents: totals.baseCents,
      vatCents: totals.vatCents,
    }));
}

export async function loadSaleDocumentPayload(
  supabase: Db,
  tenantId: string,
  documentId: string,
  tenantName: string,
): Promise<SaleDocumentPayload | null> {
  const { data: doc } = await supabase
    .from("inst_sale_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return null;

  const settings = await getPosSettings(supabase, tenantId);

  if (doc.doc_type === "credit_note" && doc.credit_note_id) {
    const { data: note } = await supabase
      .from("inst_credit_notes")
      .select(
        `
        id,
        credit_number,
        amount_cents,
        reason,
        created_at,
        sale_id,
        client_id,
        inst_sales (
          id,
          subtotal_cents,
          discount_cents,
          vat_cents,
          total_cents,
          amount_paid_cents,
          status,
          currency,
          created_at,
          inst_sale_items (
            name,
            quantity,
            unit_price_cents,
            discount_cents,
            line_subtotal_cents,
            line_vat_cents,
            line_total_cents,
            vat_rate_bps,
            item_type,
            product_id
          )
        )
      `,
      )
      .eq("tenant_id", tenantId)
      .eq("id", doc.credit_note_id)
      .maybeSingle();

    if (!note?.inst_sales) return null;

    const saleRaw = note.inst_sales;
    const sale = (Array.isArray(saleRaw) ? saleRaw[0] : saleRaw) as {
      id: string;
      subtotal_cents: number;
      discount_cents: number;
      vat_cents: number;
      total_cents: number;
      amount_paid_cents: number;
      status: string;
      currency: string;
      created_at: string;
      inst_sale_items: Array<{
        name: string;
        quantity: number;
        unit_price_cents: number;
        discount_cents: number;
        line_subtotal_cents: number;
        line_vat_cents: number;
        line_total_cents: number;
        vat_rate_bps: number;
        item_type: string;
        product_id: string | null;
      }>;
    };

    const client = note.client_id
      ? (
          await supabase
            .from("clients")
            .select("full_name, email")
            .eq("tenant_id", tenantId)
            .eq("id", note.client_id)
            .maybeSingle()
        ).data
      : null;
    const ratio = note.amount_cents / Math.max(sale.total_cents, 1);
    const creditSubtotal = Math.round(sale.subtotal_cents * ratio);
    const creditVat = Math.round(sale.vat_cents * ratio);

    const lines = sale.inst_sale_items.map((item) => ({
      reference: null,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: -Math.round(item.unit_price_cents * ratio),
      discountCents: item.discount_cents,
      lineTotalCents: -Math.round(item.line_total_cents * ratio),
      vatRateBps: item.vat_rate_bps,
      itemType: item.item_type,
    }));

    const { data: invoiceDoc } = await supabase
      .from("inst_sale_documents")
      .select("doc_number")
      .eq("tenant_id", tenantId)
      .eq("sale_id", sale.id)
      .eq("doc_type", "invoice")
      .maybeSingle();

    return {
      id: doc.id,
      docType: "credit_note",
      docNumber: doc.doc_number,
      saleGroupNumber: doc.sale_group_number,
      status: doc.status as SaleDocumentPayload["status"],
      issuedAt: doc.issued_at,
      saleId: sale.id,
      creditNoteId: note.id,
      tenantName,
      legalName: settings.legal_name ?? tenantName,
      legalAddress: settings.legal_address,
      vatNumber: settings.vat_number,
      companyId: settings.siret,
      legalEmail: settings.legal_email,
      countryCode: settings.country_code,
      currency: sale.currency,
      clientName: client?.full_name ?? client?.email ?? null,
      clientEmail: client?.email ?? null,
      staffName: null,
      cashSessionLabel: null,
      subtotalCents: -creditSubtotal,
      discountCents: 0,
      vatCents: -creditVat,
      totalCents: -note.amount_cents,
      amountPaidCents: 0,
      saleStatus: sale.status,
      lines,
      payments: [],
      vatRows: buildVatRows(
        lines.map((line) => ({
          vatRateBps: line.vatRateBps,
          lineSubtotalCents: Math.abs(line.lineTotalCents) - Math.round(Math.abs(line.lineTotalCents) * line.vatRateBps / (10000 + line.vatRateBps)),
          lineVatCents: Math.round(Math.abs(line.lineTotalCents) * line.vatRateBps / (10000 + line.vatRateBps)),
        })),
      ).map((row) => ({
        ...row,
        baseCents: -row.baseCents,
        vatCents: -row.vatCents,
      })),
      relatedDocuments: [],
      originalInvoiceNumber: invoiceDoc?.doc_number ?? null,
      creditReason: note.reason,
      paymentTermsDays: settings.payment_terms_days,
      legalMentions: getLegalMentions(settings),
      vatLabel: getVatLabel(settings),
      companyIdLabel: getCompanyIdLabel(settings),
      isCredit: true,
    };
  }

  if (!doc.sale_id) return null;

  const { data: sale } = await supabase
    .from("inst_sales")
    .select(
      `
      id,
      subtotal_cents,
      discount_cents,
      vat_cents,
      total_cents,
      amount_paid_cents,
      status,
      currency,
      created_at,
      staff_id,
      cash_session_id,
      clients ( full_name, email ),
      inst_sale_items (
        name,
        quantity,
        unit_price_cents,
        discount_cents,
        line_subtotal_cents,
        line_vat_cents,
        line_total_cents,
        vat_rate_bps,
        item_type,
        product_id
      ),
      inst_sale_payments ( method, amount_cents, reference, created_at )
    `,
    )
    .eq("tenant_id", tenantId)
    .eq("id", doc.sale_id)
    .maybeSingle();

  if (!sale) return null;

  const productIds = (sale.inst_sale_items ?? [])
    .map((item) => item.product_id)
    .filter((id): id is string => Boolean(id));

  const skuByProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("inst_products")
      .select("id, sku")
      .eq("tenant_id", tenantId)
      .in("id", productIds);
    for (const product of products ?? []) {
      if (product.sku) skuByProduct.set(product.id, product.sku);
    }
  }

  let staffName: string | null = null;
  if (sale.staff_id) {
    const { data: staff } = await supabase
      .from("inst_staff")
      .select("full_name")
      .eq("tenant_id", tenantId)
      .eq("id", sale.staff_id)
      .maybeSingle();
    staffName = staff?.full_name ?? null;
  }

  const { data: relatedDocs } = await supabase
    .from("inst_sale_documents")
    .select("doc_type, doc_number")
    .eq("tenant_id", tenantId)
    .eq("sale_id", sale.id)
    .neq("id", doc.id);

  const client = sale.clients as { full_name: string | null; email: string } | null;
  const items = (sale.inst_sale_items ?? []) as Array<{
    name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
    line_subtotal_cents: number;
    line_vat_cents: number;
    line_total_cents: number;
    vat_rate_bps: number;
    item_type: string;
    product_id: string | null;
  }>;

  const filteredItems =
    doc.doc_type === "delivery_note"
      ? items.filter((item) => item.item_type === "product")
      : items;

  const lines = filteredItems.map((item) => ({
    reference: item.product_id ? (skuByProduct.get(item.product_id) ?? null) : null,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    discountCents: item.discount_cents,
    lineTotalCents: item.line_total_cents,
    vatRateBps: item.vat_rate_bps,
    itemType: item.item_type,
  }));

  const payments = ((sale.inst_sale_payments ?? []) as Array<{
    method: string;
    amount_cents: number;
    reference: string | null;
    created_at: string;
  }>).map((payment) => ({
    method: payment.method,
    amountCents: payment.amount_cents,
    reference: payment.reference,
    paidAt: payment.created_at,
  }));

  const legalMentions = getLegalMentions(settings);

  return {
    id: doc.id,
    docType: doc.doc_type as SaleDocumentPayload["docType"],
    docNumber: doc.doc_number,
    saleGroupNumber: doc.sale_group_number,
    status: doc.status as SaleDocumentPayload["status"],
    issuedAt: doc.issued_at,
    saleId: sale.id,
    creditNoteId: null,
    tenantName,
    legalName: settings.legal_name ?? tenantName,
    legalAddress: settings.legal_address,
    vatNumber: settings.vat_number,
    companyId: settings.siret,
    legalEmail: settings.legal_email,
    countryCode: settings.country_code,
    currency: sale.currency,
    clientName: client?.full_name ?? client?.email ?? null,
    clientEmail: client?.email ?? null,
    staffName,
    cashSessionLabel: sale.cash_session_id ? "Caisse BeautyHub" : null,
    subtotalCents: sale.subtotal_cents,
    discountCents: sale.discount_cents,
    vatCents: sale.vat_cents,
    totalCents: sale.total_cents,
    amountPaidCents: sale.amount_paid_cents,
    saleStatus: sale.status,
    lines,
    payments,
    vatRows: buildVatRows(
      filteredItems.map((item) => ({
        vatRateBps: item.vat_rate_bps,
        lineSubtotalCents: item.line_subtotal_cents,
        lineVatCents: item.line_vat_cents,
      })),
    ),
    relatedDocuments: (relatedDocs ?? []).map((related) => ({
      docType: related.doc_type as SaleDocumentPayload["docType"],
      docNumber: related.doc_number,
    })),
    originalInvoiceNumber: null,
    creditReason: null,
    paymentTermsDays: settings.payment_terms_days,
    legalMentions,
    vatLabel: getVatLabel(settings),
    companyIdLabel: getCompanyIdLabel(settings),
    isCredit: false,
  };
}

export async function loadTicketPayloadBySaleId(
  supabase: Db,
  tenantId: string,
  saleId: string,
  tenantName: string,
): Promise<SaleDocumentPayload | null> {
  const { data: ticketDoc } = await supabase
    .from("inst_sale_documents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sale_id", saleId)
    .eq("doc_type", "ticket")
    .maybeSingle();

  if (!ticketDoc) return null;
  return loadSaleDocumentPayload(supabase, tenantId, ticketDoc.id, tenantName);
}
