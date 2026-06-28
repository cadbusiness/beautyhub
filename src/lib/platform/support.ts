import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";

export type SupportCategory = "help" | "bug" | "config" | "feature_request";
export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

type SupportTicketUpdate = Database["public"]["Tables"]["support_tickets"]["Update"];

export type SupportTicketRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  body: string;
  category: SupportCategory;
  status: SupportStatus;
  ai_summary: string | null;
  conversation_excerpt: string | null;
  page_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { name: string; slug: string } | null;
};

export async function createSupportTicket(input: {
  tenantId: string;
  userId: string;
  subject: string;
  body: string;
  category: SupportCategory;
  aiSummary?: string;
  conversationExcerpt?: string;
  pageUrl?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      category: input.category,
      ai_summary: input.aiSummary?.trim() || null,
      conversation_excerpt: input.conversationExcerpt?.trim() || null,
      page_url: input.pageUrl?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Impossible de créer la demande." };
  }

  return { ok: true, id: data.id };
}

export async function fetchSupportTickets(options?: {
  status?: SupportStatus | "all";
}): Promise<SupportTicketRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("support_tickets")
    .select(
      "id, tenant_id, user_id, subject, body, category, status, ai_summary, conversation_excerpt, page_url, admin_notes, created_at, updated_at, tenant:tenants(name, slug)",
    )
    .order("created_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    q = q.eq("status", options.status);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data as SupportTicketRow[];
}

export async function updateSupportTicket(input: {
  id: string;
  status?: SupportStatus;
  adminNotes?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const payload: SupportTicketUpdate = {};
  if (input.status) payload.status = input.status;
  if (input.adminNotes !== undefined) payload.admin_notes = input.adminNotes;

  const { error } = await supabase.from("support_tickets").update(payload).eq("id", input.id);
  if (error) return { error: error.message };
  return {};
}

export async function countOpenSupportTickets(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}
