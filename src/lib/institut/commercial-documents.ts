import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export type BookingMode = "instant" | "quote" | "manual";
export type DocumentType = "quote_request" | "quote";
export type DocumentStatus =
  | "pending"
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "converted";

export type DocumentTemplateId = "elegant" | "minimal" | "wedding" | "artist";

export type DocumentLineInput = {
  label: string;
  description?: string | null;
  quantity: number;
  unit_price_cents: number;
  service_id?: string | null;
  sort_order?: number;
};

export type ClientQuote = {
  id: string;
  doc_type: DocumentType;
  status: DocumentStatus;
  doc_number: string | null;
  public_token: string;
  client_message: string | null;
  internal_notes: string | null;
  event_date: string | null;
  valid_until: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  template_id: DocumentTemplateId;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
  service_id: string | null;
  service_name: string | null;
  line_count: number;
};

export type ClientQuotesPayload = {
  quotes: ClientQuote[];
};

export type PublicQuoteLine = {
  label: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
};

export type PublicQuoteView = {
  id: string;
  doc_number: string | null;
  status: DocumentStatus;
  template_id: DocumentTemplateId;
  client_message: string | null;
  event_date: string | null;
  valid_until: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  lines: PublicQuoteLine[];
  tenant: { name: string; slug: string };
  client: { full_name: string | null; email: string };
  service: { name: string } | null;
  branding: {
    primary_color?: string;
    display_name?: string | null;
    logo_url?: string | null;
  };
  legal: {
    legal_name?: string | null;
    legal_address?: string | null;
    vat_number?: string | null;
    siret?: string | null;
  };
};

export function formatQuoteNumber(seq: number): string {
  return `DEV-${String(seq).padStart(5, "0")}`;
}

export function computeDocumentTotals(
  lines: DocumentLineInput[],
  discountCents = 0,
): { subtotal_cents: number; discount_cents: number; total_cents: number } {
  const subtotal_cents = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unit_price_cents),
    0,
  );
  const discount_cents = Math.max(0, Math.min(discountCents, subtotal_cents));
  return {
    subtotal_cents,
    discount_cents,
    total_cents: subtotal_cents - discount_cents,
  };
}

export async function fetchClientQuotes(
  supabase: Db,
  tenantId: string,
  clientId: string,
): Promise<ClientQuotesPayload> {
  const { data: rows } = await supabase
    .from("inst_commercial_documents")
    .select(
      "id, doc_type, status, doc_number, public_token, client_message, internal_notes, event_date, valid_until, subtotal_cents, discount_cents, total_cents, currency, template_id, sent_at, accepted_at, declined_at, created_at, service_id",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const docIds = (rows ?? []).map((r) => r.id);
  const serviceIds = [...new Set((rows ?? []).map((r) => r.service_id).filter(Boolean))] as string[];

  const [{ data: lineCounts }, { data: services }] = await Promise.all([
    docIds.length
      ? supabase
          .from("inst_commercial_document_lines")
          .select("document_id")
          .in("document_id", docIds)
      : Promise.resolve({ data: [] as Array<{ document_id: string }> }),
    serviceIds.length
      ? supabase.from("inst_services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const countByDoc = new Map<string, number>();
  for (const row of lineCounts ?? []) {
    countByDoc.set(row.document_id, (countByDoc.get(row.document_id) ?? 0) + 1);
  }
  const serviceNames = new Map((services ?? []).map((s) => [s.id, s.name]));

  return {
    quotes: (rows ?? []).map((r) => ({
      id: r.id,
      doc_type: r.doc_type as DocumentType,
      status: r.status as DocumentStatus,
      doc_number: r.doc_number,
      public_token: r.public_token,
      client_message: r.client_message,
      internal_notes: r.internal_notes,
      event_date: r.event_date,
      valid_until: r.valid_until,
      subtotal_cents: r.subtotal_cents,
      discount_cents: r.discount_cents,
      total_cents: r.total_cents,
      currency: r.currency,
      template_id: r.template_id as DocumentTemplateId,
      sent_at: r.sent_at,
      accepted_at: r.accepted_at,
      declined_at: r.declined_at,
      created_at: r.created_at,
      service_id: r.service_id,
      service_name: r.service_id ? (serviceNames.get(r.service_id) ?? null) : null,
      line_count: countByDoc.get(r.id) ?? 0,
    })),
  };
}

export async function fetchPublicQuoteByToken(
  supabase: Db,
  token: string,
): Promise<PublicQuoteView | null> {
  const { data } = await supabase.rpc("get_public_quote_by_token", { p_token: token });
  if (!data || typeof data !== "object") return null;
  return data as unknown as PublicQuoteView;
}

export async function nextQuoteNumber(supabase: Db, tenantId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_document_number", {
    p_tenant_id: tenantId,
    p_doc_type: "quote",
  });
  if (error) throw new Error(error.message);
  return formatQuoteNumber(data as number);
}

export async function syncDocumentLines(
  supabase: Db,
  tenantId: string,
  documentId: string,
  lines: DocumentLineInput[],
): Promise<string | null> {
  const { error: delErr } = await supabase
    .from("inst_commercial_document_lines")
    .delete()
    .eq("document_id", documentId)
    .eq("tenant_id", tenantId);
  if (delErr) return delErr.message;

  if (lines.length === 0) return null;

  const { error: insErr } = await supabase.from("inst_commercial_document_lines").insert(
    lines.map((line, index) => ({
      tenant_id: tenantId,
      document_id: documentId,
      sort_order: line.sort_order ?? index,
      label: line.label,
      description: line.description ?? null,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
      service_id: line.service_id ?? null,
    })),
  );
  return insErr?.message ?? null;
}
