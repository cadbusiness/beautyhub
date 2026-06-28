"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  computeDocumentTotals,
  nextQuoteNumber,
  syncDocumentLines,
  type DocumentLineInput,
  type DocumentTemplateId,
} from "@/lib/institut/commercial-documents";

export type QuoteActionResult = { ok?: boolean; error?: string; quoteId?: string };

function parseLinesJson(raw: string): DocumentLineInput[] | null {
  try {
    const parsed = JSON.parse(raw) as DocumentLineInput[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed
      .map((line, index) => ({
        label: String(line.label ?? "").trim(),
        description: line.description ? String(line.description).trim() : null,
        quantity: Number(line.quantity) || 1,
        unit_price_cents: Math.round(Number(line.unit_price_cents) || 0),
        service_id: line.service_id ?? null,
        sort_order: index,
      }))
      .filter((line) => line.label.length > 0);
  } catch {
    return null;
  }
}

function parseTemplate(raw: string): DocumentTemplateId {
  if (raw === "minimal" || raw === "wedding" || raw === "artist") return raw;
  return "elegant";
}

export async function createQuoteForClient(
  _prev: QuoteActionResult,
  formData: FormData,
): Promise<QuoteActionResult> {
  const t = await getTranslations("institut.quotes.actions");
  const session = await requireModule("institut");
  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) return { error: t("clientRequired") };

  const lines = parseLinesJson(String(formData.get("lines_json") ?? ""));
  if (!lines?.length) return { error: t("linesRequired") };

  const discountCents = Math.round(Number(formData.get("discount_cents") ?? 0) || 0);
  const totals = computeDocumentTotals(lines, discountCents);
  const templateId = parseTemplate(String(formData.get("template_id") ?? ""));
  const validUntil = String(formData.get("valid_until") ?? "").trim() || null;
  const internalNotes = String(formData.get("internal_notes") ?? "").trim() || null;
  const sourceDocumentId = String(formData.get("source_document_id") ?? "").trim() || null;
  const serviceId = String(formData.get("service_id") ?? "").trim() || null;

  const supabase = await createClient();
  let docNumber: string;
  try {
    docNumber = await nextQuoteNumber(supabase, session.tenant.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("numberError") };
  }

  const { data: doc, error } = await supabase
    .from("inst_commercial_documents")
    .insert({
      tenant_id: session.tenant.id,
      client_id: clientId,
      service_id: serviceId || null,
      source_document_id: sourceDocumentId || null,
      doc_type: "quote",
      status: "draft",
      doc_number: docNumber,
      internal_notes: internalNotes,
      valid_until: validUntil,
      subtotal_cents: totals.subtotal_cents,
      discount_cents: totals.discount_cents,
      total_cents: totals.total_cents,
      template_id: templateId,
    })
    .select("id")
    .single();

  if (error || !doc) return { error: error?.message ?? t("createError") };

  const lineErr = await syncDocumentLines(supabase, session.tenant.id, doc.id, lines);
  if (lineErr) return { error: lineErr };

  if (sourceDocumentId) {
    await supabase
      .from("inst_commercial_documents")
      .update({ status: "converted" })
      .eq("id", sourceDocumentId)
      .eq("tenant_id", session.tenant.id);
  }

  revalidatePath(`/institut/clients/${clientId}`);
  return { ok: true, quoteId: doc.id };
}

export async function sendQuote(formData: FormData): Promise<void> {
  const t = await getTranslations("institut.quotes.actions");
  const session = await requireModule("institut");
  const quoteId = String(formData.get("quote_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("inst_commercial_documents")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("tenant_id", session.tenant.id)
    .eq("doc_type", "quote")
    .in("status", ["draft", "sent"]);

  if (error) {
    console.error("[sendQuote]", t("quoteNotFound"), error.message);
    return;
  }
  if (clientId) revalidatePath(`/institut/clients/${clientId}`);
}

export async function cancelQuote(formData: FormData): Promise<void> {
  const session = await requireModule("institut");
  const quoteId = String(formData.get("quote_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("inst_commercial_documents")
    .update({ status: "cancelled" })
    .eq("id", quoteId)
    .eq("tenant_id", session.tenant.id);

  if (error) {
    console.error("[cancelQuote]", error.message);
    return;
  }
  if (clientId) revalidatePath(`/institut/clients/${clientId}`);
}
