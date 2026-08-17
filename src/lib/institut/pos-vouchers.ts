import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { formatTicketNumber, getPosSettings } from "./pos-settings";
import {
  generateGiftCardCode,
  getOpenCashSession,
  isCashSessionPaused,
} from "./pos-session";
import { issueVoucher, redeemVoucher } from "./vouchers-core";
import { generateCreditNoteDocument } from "./sale-documents/generate";

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

export type CreditNoteSettlement = "credit" | "cash" | "card";

export async function creditedCentsBySaleIds(
  supabase: Db,
  tenantId: string,
  saleIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (saleIds.length === 0) return map;
  const { data } = await supabase
    .from("inst_credit_notes")
    .select("sale_id, amount_cents, status")
    .eq("tenant_id", tenantId)
    .in("sale_id", saleIds);
  for (const row of data ?? []) {
    if (!row.sale_id || row.status === "cancelled") continue;
    map.set(row.sale_id, (map.get(row.sale_id) ?? 0) + row.amount_cents);
  }
  return map;
}

export async function createCreditNoteFromSale(
  supabase: Db,
  tenantId: string,
  opts: {
    saleId: string;
    amountCents: number;
    reason?: string;
    clientId?: string | null;
    settlement?: CreditNoteSettlement;
    intent?: "credit" | "refund" | "replacement";
  },
): Promise<{
  id: string;
  creditNumber: string;
  documentId: string | null;
  settlement: CreditNoteSettlement;
  remainingRefundableCents: number;
}> {
  const settlement: CreditNoteSettlement =
    opts.settlement === "cash" || opts.settlement === "card"
      ? opts.settlement
      : "credit";
  const reason = opts.reason?.trim() || "";
  if (reason.length < 3) throw new Error("reason_required");

  const { data: sale } = await supabase
    .from("inst_sales")
    .select("id, ticket_number, total_cents, amount_paid_cents, client_id, status")
    .eq("tenant_id", tenantId)
    .eq("id", opts.saleId)
    .single();
  if (!sale) throw new Error("sale_not_found");
  if (sale.status === "refunded") throw new Error("sale_already_refunded");

  const creditedMap = await creditedCentsBySaleIds(supabase, tenantId, [
    opts.saleId,
  ]);
  const alreadyCredited = creditedMap.get(opts.saleId) ?? 0;
  const maxRefund = Math.max(0, sale.amount_paid_cents - alreadyCredited);
  if (maxRefund <= 0) throw new Error("sale_already_refunded");
  if (opts.amountCents <= 0 || opts.amountCents > maxRefund) {
    throw new Error("credit_amount_invalid");
  }

  if (settlement === "cash") {
    const cashSession = await getOpenCashSession(supabase, tenantId);
    if (!cashSession) throw new Error("no_open_session");
    if (isCashSessionPaused(cashSession)) throw new Error("session_paused");
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
      reason,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !note) throw new Error(error?.message ?? "credit_note_failed");

  const metadata: Json = {
    legacy_table: "inst_credit_notes",
    legacy_id: note.id,
    reason,
    settlement,
    intent: opts.intent ?? (settlement === "credit" ? "credit" : "refund"),
  };

  try {
    await issueVoucher(supabase, tenantId, {
      code: creditNumber,
      voucherType: "credit_note",
      sourceChannel: "pos",
      amountCents: opts.amountCents,
      clientId: opts.clientId ?? sale.client_id,
      saleId: opts.saleId,
      metadata,
      idempotencyKey: `legacy-credit-note:${tenantId}:${note.id}`,
    });
  } catch {
    // Keep legacy credit note issuance usable even if voucher-core mirror fails.
  }

  if (settlement === "cash") {
    const cashSession = await getOpenCashSession(supabase, tenantId);
    if (!cashSession) throw new Error("no_open_session");
    if (isCashSessionPaused(cashSession)) throw new Error("session_paused");
    const ticketRef = sale.ticket_number ? ` n° ${sale.ticket_number}` : "";
    const { error: movementError } = await supabase
      .from("inst_cash_movements")
      .insert({
        tenant_id: tenantId,
        session_id: cashSession.id,
        movement_type: "out",
        amount_cents: opts.amountCents,
        reason: `Remboursement${ticketRef} · ${creditNumber} · ${reason}`.slice(
          0,
          240,
        ),
      });
    if (movementError) throw new Error(movementError.message);
  }

  if (settlement === "cash" || settlement === "card") {
    await redeemCreditNote(supabase, tenantId, note.id, opts.amountCents);
    try {
      await redeemVoucher(supabase, tenantId, {
        code: creditNumber,
        amountCents: opts.amountCents,
        sourceChannel: "pos",
        saleId: opts.saleId,
        metadata: {
          payout: true,
          method: settlement,
          reason,
        },
        idempotencyKey: `credit-payout:${tenantId}:${note.id}:${settlement}`,
      });
    } catch {
      // Legacy note is already depleted; voucher ledger is best-effort.
    }
  }

  const creditedAfter = alreadyCredited + opts.amountCents;
  const newStatus =
    creditedAfter >= sale.amount_paid_cents ? "refunded" : sale.status;
  await supabase
    .from("inst_sales")
    .update({ status: newStatus })
    .eq("id", opts.saleId)
    .eq("tenant_id", tenantId);

  const documentId = await generateCreditNoteDocument(
    supabase,
    tenantId,
    note.id,
    creditNumber,
    opts.saleId,
  );

  return {
    id: note.id,
    creditNumber,
    documentId,
    settlement,
    remainingRefundableCents: Math.max(0, maxRefund - opts.amountCents),
  };
}
