"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { requireInstitutSettingsModule } from "@/lib/auth/institut-settings";
import {
  computeSessionSnapshot,
  getOpenCashSession,
  nextReportNumber,
} from "@/lib/institut/pos-session";
import type { Json } from "@/lib/db/database.types";
import type { ActionResult } from "./caisse-actions";

function revalidateSession() {
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/session");
  revalidatePath("/institut/caisse/bons");
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
  const session = await requireModule("institut");
  const supabase = await createClient();

  const existing = await getOpenCashSession(supabase, session.tenant.id);
  if (existing) return { error: t("sessionAlreadyOpen") };

  const openingFloat = parseEurosCents(formData.get("opening_float"));

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
  const session = await requireModule("institut");
  const supabase = await createClient();

  const cashSession = await getOpenCashSession(supabase, session.tenant.id);
  if (!cashSession) return { error: t("noOpenSession") };

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
  const session = await requireModule("institut");
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

export async function closeCashSession(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult & { reportId?: string }> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const cashSession = await getOpenCashSession(supabase, session.tenant.id);
  if (!cashSession) return { error: t("noOpenSession") };

  const countedCash = parseEurosCents(formData.get("counted_cash"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const snapshot = await computeSessionSnapshot(
    supabase,
    session.tenant.id,
    cashSession.id,
    "z",
  );
  const reportNumber = await nextReportNumber(
    supabase,
    session.tenant.id,
    "z",
    "Z",
  );

  const variance = countedCash - snapshot.expected_cash_cents;

  const { data: report, error: reportErr } = await supabase
    .from("inst_cash_reports")
    .insert({
      tenant_id: session.tenant.id,
      session_id: cashSession.id,
      report_type: "z",
      report_number: reportNumber,
      snapshot: { ...snapshot, closing_counted_cents: countedCash, variance_cents: variance } as unknown as Json,
    })
    .select("id")
    .single();
  if (reportErr || !report) {
    return { error: reportErr?.message ?? t("reportFailed") };
  }

  const { error: closeErr } = await supabase
    .from("inst_cash_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closing_counted_cents: countedCash,
      closing_expected_cents: snapshot.expected_cash_cents,
      closing_variance_cents: variance,
      z_report_number: reportNumber,
      notes,
    })
    .eq("id", cashSession.id)
    .eq("tenant_id", session.tenant.id);
  if (closeErr) return { error: closeErr.message };

  revalidateSession();
  return { ok: true, message: `${t("sessionClosed")} · ${reportNumber}`, reportId: report.id };
}

export async function issueGiftCardAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const amount = parseEurosCents(formData.get("amount"));
  if (amount <= 0) return { error: t("invalidAmount") };

  const { issueGiftCard } = await import("@/lib/institut/pos-vouchers");
  try {
    const card = await issueGiftCard(supabase, session.tenant.id, {
      amountCents: amount,
      clientId: String(formData.get("client_id") ?? "") || null,
      recipientName: String(formData.get("recipient_name") ?? "").trim() || undefined,
    });
    revalidateSession();
    return { ok: true, message: `${t("giftCardIssued")} · ${card.code}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCreditNoteAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const supabase = await createClient();

  const saleId = String(formData.get("sale_id") ?? "");
  const amount = parseEurosCents(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  if (!saleId) return { error: t("saleNotFound") };
  if (amount <= 0) return { error: t("invalidAmount") };

  const { createCreditNoteFromSale } = await import("@/lib/institut/pos-vouchers");
  try {
    const note = await createCreditNoteFromSale(supabase, session.tenant.id, {
      saleId,
      amountCents: amount,
      reason,
    });
    revalidateSession();
    return { ok: true, message: `${t("creditNoteCreated")} · ${note.creditNumber}` };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "credit_amount_invalid") return { error: t("creditAmountInvalid") };
    if (msg === "sale_not_found") return { error: t("saleNotFound") };
    return { error: msg };
  }
}

export async function payBalanceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
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
