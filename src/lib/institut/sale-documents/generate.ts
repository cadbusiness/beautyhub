import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  formatDocumentNumber,
  getPosSettings,
  type PosSettings,
} from "@/lib/institut/pos-settings";
import type { SaleDocumentStatus, SaleDocumentType } from "./types";

type Db = SupabaseClient<Database>;

async function nextDocumentSeq(
  supabase: Db,
  tenantId: string,
  docType: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("next_document_number", {
    p_tenant_id: tenantId,
    p_doc_type: docType,
  });
  if (error || data == null) {
    throw new Error(error?.message ?? `${docType}_number_failed`);
  }
  return data as number;
}

function ticketStatus(saleStatus: string): SaleDocumentStatus {
  if (saleStatus === "partial") return "partial";
  if (saleStatus === "paid") return "paid";
  return "issued";
}

function invoiceStatus(saleStatus: string, amountPaid: number, total: number): SaleDocumentStatus {
  if (saleStatus === "refunded") return "cancelled";
  if (amountPaid >= total && total > 0) return "settled";
  if (amountPaid > 0) return "partial";
  return "issued";
}

export async function updateSaleDocumentStatuses(
  supabase: Db,
  tenantId: string,
  saleId: string,
  saleStatus: string,
  amountPaidCents: number,
  totalCents: number,
): Promise<void> {
  const ticket = ticketStatus(saleStatus);
  const invoice = invoiceStatus(saleStatus, amountPaidCents, totalCents);

  await supabase
    .from("inst_sale_documents")
    .update({ status: ticket })
    .eq("tenant_id", tenantId)
    .eq("sale_id", saleId)
    .eq("doc_type", "ticket");

  await supabase
    .from("inst_sale_documents")
    .update({ status: invoice })
    .eq("tenant_id", tenantId)
    .eq("sale_id", saleId)
    .eq("doc_type", "invoice");
}

export async function generateSaleDocuments(
  supabase: Db,
  tenantId: string,
  saleId: string,
  opts: {
    ticketNumber: string;
    saleStatus: string;
    amountPaidCents: number;
    totalCents: number;
    hasProducts: boolean;
    settings?: PosSettings;
  },
): Promise<void> {
  const settings = opts.settings ?? (await getPosSettings(supabase, tenantId));

  const saleGroupNumber = await nextDocumentSeq(supabase, tenantId, "sale_group");

  await supabase
    .from("inst_sales")
    .update({ sale_group_number: saleGroupNumber })
    .eq("tenant_id", tenantId)
    .eq("id", saleId);

  const ticketSeq = await nextDocumentSeq(supabase, tenantId, "ticket");
  const ticketDocNumber = opts.ticketNumber || formatDocumentNumber(settings.ticket_prefix, ticketSeq);

  const invoiceSeq = await nextDocumentSeq(supabase, tenantId, "invoice");
  const invoiceDocNumber = formatDocumentNumber(settings.invoice_prefix, invoiceSeq);

  const rows: Array<{
    tenant_id: string;
    sale_id: string;
    doc_type: SaleDocumentType;
    doc_number: string;
    sale_group_number: number;
    status: SaleDocumentStatus;
  }> = [
    {
      tenant_id: tenantId,
      sale_id: saleId,
      doc_type: "ticket",
      doc_number: ticketDocNumber,
      sale_group_number: saleGroupNumber,
      status: ticketStatus(opts.saleStatus),
    },
    {
      tenant_id: tenantId,
      sale_id: saleId,
      doc_type: "invoice",
      doc_number: invoiceDocNumber,
      sale_group_number: saleGroupNumber,
      status: invoiceStatus(opts.saleStatus, opts.amountPaidCents, opts.totalCents),
    },
  ];

  if (opts.hasProducts) {
    const blSeq = await nextDocumentSeq(supabase, tenantId, "delivery_note");
    rows.push({
      tenant_id: tenantId,
      sale_id: saleId,
      doc_type: "delivery_note",
      doc_number: formatDocumentNumber(settings.delivery_note_prefix, blSeq),
      sale_group_number: saleGroupNumber,
      status: "delivered",
    });
  }

  const { error } = await supabase.from("inst_sale_documents").insert(rows);
  if (error) throw new Error(error.message);
}

export async function generateCreditNoteDocument(
  supabase: Db,
  tenantId: string,
  creditNoteId: string,
  creditNumber: string,
  saleId: string,
): Promise<void> {
  const { data: sale } = await supabase
    .from("inst_sales")
    .select("sale_group_number")
    .eq("tenant_id", tenantId)
    .eq("id", saleId)
    .maybeSingle();

  const { error } = await supabase.from("inst_sale_documents").insert({
    tenant_id: tenantId,
    sale_id: saleId,
    credit_note_id: creditNoteId,
    doc_type: "credit_note",
    doc_number: creditNumber,
    sale_group_number: sale?.sale_group_number ?? null,
    status: "issued",
  });

  if (error) throw new Error(error.message);
}
