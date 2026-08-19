"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireInstitutAccess } from "@/lib/auth/guards";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import {
  computeSessionSnapshot,
  getOpenCashSession,
  isCashSessionPaused,
  nextReportNumber,
  closeOpenCashSession,
  pauseOpenCashSession,
  resumePausedCashSession,
} from "@/lib/institut/pos-session";
import type { Json } from "@/lib/db/database.types";
import type { ActionResult } from "./caisse-actions";
import {
  issueVoucher,
  voidVoucher,
  type VoucherType,
} from "@/lib/institut/vouchers-core";

function revalidateSession() {
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/session");
  revalidatePath("/institut/caisse/bons");
  revalidatePath("/institut/caisse/bons/voucher");
  revalidatePath("/institut/caisse/historique");
}

function parseEurosCents(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function openCashSession(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const existing = await getOpenCashSession(supabase, session.tenant.id);
  if (existing) return { error: t("sessionAlreadyOpen") };

  const mode = String(formData.get("mode") ?? "float");
  const openingFloat =
    mode === "skip" ? 0 : parseEurosCents(formData.get("opening_float"));

  const { error } = await supabase.from("inst_cash_sessions").insert({
    tenant_id: session.tenant.id,
    opening_float_cents: openingFloat,
    status: "open",
  });
  if (error) return { error: error.message };

  revalidateSession();
  return { ok: true, message: t("sessionOpened") };
}

export async function addCashMovement(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const cashSession = await getOpenCashSession(supabase, session.tenant.id);
  if (!cashSession) return { error: t("noOpenSession") };
  if (isCashSessionPaused(cashSession)) return { error: t("sessionPaused") };

  const movementType = String(formData.get("movement_type") ?? "out");
  const amount = parseEurosCents(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (amount <= 0) return { error: t("invalidAmount") };
  if (!reason) return { error: t("reasonRequired") };
  if (!["in", "out", "expense"].includes(movementType)) {
    return { error: t("invalidMovementType") };
  }

  const { error } = await supabase.from("inst_cash_movements").insert({
    tenant_id: session.tenant.id,
    session_id: cashSession.id,
    movement_type: movementType,
    amount_cents: amount,
    reason,
  });
  if (error) return { error: error.message };

  revalidateSession();
  return { ok: true, message: t("movementRecorded") };
}

export async function generateXReport(): Promise<ActionResult & { reportId?: string }> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const cashSession = await getOpenCashSession(supabase, session.tenant.id);
  if (!cashSession) return { error: t("noOpenSession") };

  const snapshot = await computeSessionSnapshot(
    supabase,
    session.tenant.id,
    cashSession.id,
    "x",
  );
  const reportNumber = await nextReportNumber(
    supabase,
    session.tenant.id,
    "x",
    "X",
  );

  const { data, error } = await supabase
    .from("inst_cash_reports")
    .insert({
      tenant_id: session.tenant.id,
      session_id: cashSession.id,
      report_type: "x",
      report_number: reportNumber,
      snapshot: snapshot as unknown as Json,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? t("reportFailed") };

  revalidateSession();
  return { ok: true, message: reportNumber, reportId: data.id };
}

export async function pauseCashSession(): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();
  try {
    await pauseOpenCashSession(supabase, session.tenant.id);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "no_open_session") return { error: t("noOpenSession") };
    return { error: msg };
  }
  revalidateSession();
  return { ok: true, message: t("sessionPausedOk") };
}

export async function resumeCashSession(): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();
  try {
    await resumePausedCashSession(supabase, session.tenant.id);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "no_open_session") return { error: t("noOpenSession") };
    return { error: msg };
  }
  revalidateSession();
  return { ok: true, message: t("sessionResumed") };
}

export async function closeCashSession(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult & { reportId?: string }> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const countedCash = parseEurosCents(formData.get("counted_cash"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const closedAt = String(formData.get("closed_at") ?? "").trim() || null;

  try {
    const result = await closeOpenCashSession(supabase, session.tenant.id, {
      countedCashCents: countedCash,
      notes,
      closedAt,
    });
    revalidateSession();
    return {
      ok: true,
      message: `${t("sessionClosed")} · ${result.reportNumber}`,
      reportId: result.reportId,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "no_open_session") return { error: t("noOpenSession") };
    if (msg === "variance_notes_required") return { error: t("varianceNotesRequired") };
    if (msg === "report_failed") return { error: t("reportFailed") };
    return { error: msg };
  }
}

export async function issueGiftCardAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const amount = parseEurosCents(formData.get("amount"));
  if (amount <= 0) return { error: t("invalidAmount") };

  const { issueGiftCardWithPdf } = await import("@/lib/institut/vouchers-core");
  const { getPosSettings } = await import("@/lib/institut/pos-settings");
  try {
    const settings = await getPosSettings(supabase, session.tenant.id);
    const card = await issueGiftCardWithPdf(supabase, session.tenant.id, {
      amountCents: amount,
      clientId: String(formData.get("client_id") ?? "") || null,
      recipientName: String(formData.get("recipient_name") ?? "").trim() || null,
      message: String(formData.get("message") ?? "").trim() || null,
      templateId: String(formData.get("template_id") ?? "").trim() || null,
      sourceChannel: "pos",
      codePrefix: settings.gift_card_prefix || "GC",
      currency: settings.currency,
    });
    revalidateSession();
    return {
      ok: true,
      message: `${t("giftCardIssued")} · ${card.code}`,
      voucherId: card.id,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function issueVoucherAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const amount = parseEurosCents(formData.get("amount"));
  if (amount <= 0) return { error: t("invalidAmount") };
  const voucherTypeRaw = String(formData.get("voucher_type") ?? "voucher");
  const voucherType: VoucherType =
    voucherTypeRaw === "gift_card" || voucherTypeRaw === "credit_note"
      ? voucherTypeRaw
      : "voucher";
  const customCode = String(formData.get("code") ?? "").trim();

  let code = customCode;
  if (!code) {
    const settings = await import("@/lib/institut/pos-settings");
    const posSettings = await settings.getPosSettings(supabase, session.tenant.id);
    const { generateGiftCardCode } = await import("@/lib/institut/pos-session");
    const prefix =
      voucherType === "gift_card"
        ? posSettings.gift_card_prefix
        : voucherType === "credit_note"
          ? posSettings.credit_note_prefix
          : "VC";
    code = generateGiftCardCode(prefix);
  }

  try {
    const voucher = await issueVoucher(supabase, session.tenant.id, {
      code,
      voucherType,
      sourceChannel: "pos",
      amountCents: amount,
      recipientName: String(formData.get("recipient_name") ?? "").trim() || null,
      clientId: String(formData.get("client_id") ?? "") || null,
      expiresAt: String(formData.get("expires_at") ?? "") || null,
      metadata: {
        issued_from: "bons_page",
      } as Json,
      idempotencyKey: `manual-issue:${session.tenant.id}:${voucherType}:${code.toUpperCase()}`,
    });
    revalidateSession();
    return { ok: true, message: `${t("voucherIssued")} · ${voucher.code}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCreditNoteAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const saleId = String(formData.get("sale_id") ?? "");
  const amount = parseEurosCents(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  const settlementRaw = String(formData.get("settlement") ?? "credit");
  const settlement =
    settlementRaw === "cash" || settlementRaw === "card" ? settlementRaw : "credit";
  const intentRaw = String(formData.get("intent") ?? "");
  const intent =
    intentRaw === "refund" || intentRaw === "replacement" || intentRaw === "credit"
      ? intentRaw
      : undefined;
  if (!saleId) return { error: t("saleNotFound") };
  if (amount <= 0) return { error: t("invalidAmount") };
  if (reason.length < 3) return { error: t("reasonRequired") };

  const { createCreditNoteFromSale } = await import("@/lib/institut/pos-vouchers");
  try {
    const note = await createCreditNoteFromSale(supabase, session.tenant.id, {
      saleId,
      amountCents: amount,
      reason,
      settlement,
      intent,
    });
    revalidateSession();
    return { ok: true, message: `${t("creditNoteCreated")} · ${note.creditNumber}` };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "credit_amount_invalid") return { error: t("creditAmountInvalid") };
    if (msg === "sale_not_found") return { error: t("saleNotFound") };
    if (msg === "sale_already_refunded") return { error: t("saleAlreadyRefunded") };
    if (msg === "reason_required") return { error: t("reasonRequired") };
    if (msg === "no_open_session") return { error: t("noOpenSession") };
    if (msg === "session_paused") return { error: t("sessionPaused") };
    return { error: msg };
  }
}

export async function payBalanceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();

  const saleId = String(formData.get("sale_id") ?? "");
  let payments;
  try {
    const { parsePaymentsJson, executeBalancePayment } = await import(
      "@/lib/institut/pos-checkout"
    );
    payments = parsePaymentsJson(String(formData.get("payments") ?? "[]"));
    const result = await executeBalancePayment(
      supabase,
      session.tenant.id,
      saleId,
      payments,
    );
    revalidateSession();
    return {
      ok: true,
      message: t("balancePaid"),
      saleId: result.saleId,
      ticketNumber: result.ticketNumber ?? undefined,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "sale_not_partial") return { error: t("saleNotPartial") };
    if (msg === "overpaid") return { error: t("overpaid") };
    return { error: msg };
  }
}

export async function voidVoucherAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutAccess("pos", "write");
  const supabase = await createClient();
  const voucherId = String(formData.get("voucher_id") ?? "");
  if (!voucherId) return { error: t("missingFields") };

  try {
    await voidVoucher(supabase, session.tenant.id, voucherId, {
      sourceChannel: "admin",
      metadata: {
        void_reason: String(formData.get("reason") ?? "").trim() || null,
      },
      idempotencyKey: `manual-void:${session.tenant.id}:${voucherId}`,
    });
    revalidateSession();
    return { ok: true, message: t("voucherVoided") };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function voidVoucherDirect(formData: FormData): Promise<void> {
  const res = await voidVoucherAction({}, formData);
  if (res.error) {
    throw new Error(res.error);
  }
}

export async function savePosSessionSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireInstitutSettingsModule();
  const supabase = await createClient();

  const { error } = await supabase.from("inst_pos_settings").upsert(
    {
      tenant_id: session.tenant.id,
      require_open_session: formData.get("require_open_session") === "on",
      default_opening_float_cents: parseEurosCents(formData.get("default_opening_float")),
    },
    { onConflict: "tenant_id" },
  );
  if (error) return { error: error.message };

  revalidateSession();
  return { ok: true, message: t("posSettingsSaved") };
}
