import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { formatTicketNumber, getPosSettings } from "./pos-settings";
import { generateGiftCardCode } from "./pos-session";
import { issueVoucher } from "./vouchers-core";

type Db = SupabaseClient<Database>;

export async function nextCreditNoteNumber(
  supabase: Db,
  tenantId: string,
): Promise<string> {
  const settings = await getPosSettings(supabase, tenantId);
  const { data, error } = await supabase.rpc("next_document_number", {
    p_tenant_id: tenantId,
    p_doc_type: "credit_note",
  });
  if (error || data == null) throw new Error(error?.message ?? "credit_number_failed");
  return formatTicketNumber(settings.credit_note_prefix, data as number);
}

export async function findGiftCardByCode(
  supabase: Db,
  tenantId: string,
  code: string,
) {
  const normalized = code.trim().toUpperCase();
  const { data } = await supabase
    .from("inst_gift_cards")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", normalized)
    .maybeSingle();
  return data;
}

export async function findCreditNoteByNumber(
  supabase: Db,
  tenantId: string,
  reference: string,
) {
  const ref = reference.trim().toUpperCase();
  const { data } = await supabase
    .from("inst_credit_notes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("credit_number", ref)
    .maybeSingle();
  return data;
}

export async function redeemGiftCard(
  supabase: Db,
  tenantId: string,
  giftCardId: string,
  amountCents: number,
): Promise<void> {
  const { data: card } = await supabase
    .from("inst_gift_cards")
    .select("balance_cents, status, expires_at")
    .eq("tenant_id", tenantId)
    .eq("id", giftCardId)
    .single();
  if (!card || card.status !== "active") throw new Error("gift_card_invalid");
  if (card.expires_at && new Date(card.expires_at) < new Date()) {
    throw new Error("gift_card_expired");
  }
  if (card.balance_cents < amountCents) throw new Error("gift_card_insufficient");

  const newBalance = card.balance_cents - amountCents;
  const { error } = await supabase
    .from("inst_gift_cards")
    .update({
      balance_cents: newBalance,
      status: newBalance === 0 ? "depleted" : "active",
    })
    .eq("id", giftCardId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function redeemCreditNote(
  supabase: Db,
  tenantId: string,
  creditNoteId: string,
  amountCents: number,
): Promise<void> {
  const { data: note } = await supabase
    .from("inst_credit_notes")
    .select("remaining_cents, status, expires_at")
    .eq("tenant_id", tenantId)
    .eq("id", creditNoteId)
    .single();
  if (!note || note.status !== "active") throw new Error("credit_note_invalid");
  if (note.expires_at && new Date(note.expires_at) < new Date()) {
    throw new Error("credit_note_expired");
  }
  if (note.remaining_cents < amountCents) throw new Error("credit_note_insufficient");

  const remaining = note.remaining_cents - amountCents;
  const { error } = await supabase
    .from("inst_credit_notes")
    .update({
      remaining_cents: remaining,
      status: remaining === 0 ? "depleted" : "active",
    })
    .eq("id", creditNoteId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function issueGiftCard(
  supabase: Db,
  tenantId: string,
  opts: {
    amountCents: number;
    clientId?: string | null;
    recipientName?: string;
    saleId?: string | null;
    expiresAt?: string | null;
  },
): Promise<{ id: string; code: string }> {
  const settings = await getPosSettings(supabase, tenantId);
  let code = generateGiftCardCode(settings.gift_card_prefix);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("inst_gift_cards")
      .insert({
        tenant_id: tenantId,
        code,
        client_id: opts.clientId ?? null,
        sale_id: opts.saleId ?? null,
        initial_balance_cents: opts.amountCents,
        balance_cents: opts.amountCents,
        recipient_name: opts.recipientName ?? null,
        expires_at: opts.expiresAt ?? null,
        status: "active",
      })
      .select("id, code")
      .single();
    if (!error && data) {
      try {
        await issueVoucher(supabase, tenantId, {
          code: data.code,
          voucherType: "gift_card",
          sourceChannel: "pos",
          amountCents: opts.amountCents,
          recipientName: opts.recipientName ?? null,
          clientId: opts.clientId ?? null,
          expiresAt: opts.expiresAt ?? null,
          saleId: opts.saleId ?? null,
          metadata: {
            legacy_table: "inst_gift_cards",
            legacy_id: data.id,
          },
          idempotencyKey: `legacy-gift-card:${tenantId}:${data.id}`,
        });
      } catch {
        // Keep legacy issuance usable even if voucher-core mirror fails.
      }
      return data;
    }
    code = generateGiftCardCode(settings.gift_card_prefix);
  }
  throw new Error("gift_card_create_failed");
}

export async function createCreditNoteFromSale(
  supabase: Db,
  tenantId: string,
  opts: {
    saleId: string;
    amountCents: number;
    reason?: string;
    clientId?: string | null;
  },
): Promise<{ id: string; creditNumber: string }> {
  const { data: sale } = await supabase
    .from("inst_sales")
    .select("id, total_cents, amount_paid_cents, client_id, status")
    .eq("tenant_id", tenantId)
    .eq("id", opts.saleId)
    .single();
  if (!sale) throw new Error("sale_not_found");
  if (sale.status === "refunded") throw new Error("sale_already_refunded");
  const maxRefund = sale.amount_paid_cents;
  if (opts.amountCents <= 0 || opts.amountCents > maxRefund) {
    throw new Error("credit_amount_invalid");
  }

  const creditNumber = await nextCreditNoteNumber(supabase, tenantId);
  const { data: note, error } = await supabase
    .from("inst_credit_notes")
    .insert({
      tenant_id: tenantId,
      client_id: opts.clientId ?? sale.client_id,
      sale_id: opts.saleId,
      credit_number: creditNumber,
      amount_cents: opts.amountCents,
      remaining_cents: opts.amountCents,
      reason: opts.reason ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !note) throw new Error(error?.message ?? "credit_note_failed");

  try {
    await issueVoucher(supabase, tenantId, {
      code: creditNumber,
      voucherType: "credit_note",
      sourceChannel: "pos",
      amountCents: opts.amountCents,
      clientId: opts.clientId ?? sale.client_id,
      saleId: opts.saleId,
      metadata: {
        legacy_table: "inst_credit_notes",
        legacy_id: note.id,
        reason: opts.reason ?? null,
      },
      idempotencyKey: `legacy-credit-note:${tenantId}:${note.id}`,
    });
  } catch {
    // Keep legacy credit note issuance usable even if voucher-core mirror fails.
  }

  const newStatus =
    opts.amountCents >= sale.amount_paid_cents ? "refunded" : sale.status;
  await supabase
    .from("inst_sales")
    .update({ status: newStatus })
    .eq("id", opts.saleId)
    .eq("tenant_id", tenantId);

  return { id: note.id, creditNumber };
}
