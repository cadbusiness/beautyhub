import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { resolveClient, resolveService } from "./ai-helpers";

type Db = SupabaseClient<Database>;

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export async function resolveProduct(
  supabase: Db,
  tenantId: string,
  input: { product_id?: string; product_name?: string },
) {
  if (input.product_id) {
    const { data } = await supabase
      .from("inst_products")
      .select("id, name, price_cents")
      .eq("tenant_id", tenantId)
      .eq("id", input.product_id)
      .maybeSingle();
    return data;
  }
  const name = input.product_name?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("inst_products")
    .select("id, name, price_cents")
    .eq("tenant_id", tenantId)
    .ilike("name", `%${name}%`)
    .in("status", ["active", "publish"])
    .limit(2);
  if (!data?.length) return null;
  if (data.length > 1) {
    throw new Error(
      `Plusieurs produits correspondent à « ${name} » : ${data.map((p) => p.name).join(", ")}.`,
    );
  }
  return data[0];
}

export async function resolveSale(
  supabase: Db,
  tenantId: string,
  input: { sale_id?: string; ticket_number?: string },
) {
  if (input.sale_id) {
    const { data } = await supabase
      .from("inst_sales")
      .select(
        "id, ticket_number, total_cents, amount_paid_cents, status, created_at, client:clients(full_name)",
      )
      .eq("tenant_id", tenantId)
      .eq("id", input.sale_id)
      .maybeSingle();
    return data;
  }
  const ticket = input.ticket_number?.trim().toUpperCase();
  if (!ticket) return null;
  const { data } = await supabase
    .from("inst_sales")
    .select(
      "id, ticket_number, total_cents, amount_paid_cents, status, created_at, client:clients(full_name)",
    )
    .eq("tenant_id", tenantId)
    .eq("ticket_number", ticket)
    .maybeSingle();
  return data;
}

export type CartLineInput = {
  service_name?: string;
  product_name?: string;
  service_id?: string;
  product_id?: string;
  quantity?: number;
};

export async function buildCartJson(
  supabase: Db,
  tenantId: string,
  lines: CartLineInput[],
): Promise<string> {
  const cart: Record<string, number> = {};
  for (const line of lines) {
    const qty = Math.max(1, line.quantity ?? 1);
    if (line.service_id || line.service_name) {
      const service = await resolveService(supabase, tenantId, line);
      if (!service) throw new Error("Prestation introuvable dans le panier.");
      cart[`service:${service.id}`] = (cart[`service:${service.id}`] ?? 0) + qty;
    } else if (line.product_id || line.product_name) {
      const product = await resolveProduct(supabase, tenantId, line);
      if (!product) throw new Error("Produit introuvable dans le panier.");
      cart[`product:${product.id}`] = (cart[`product:${product.id}`] ?? 0) + qty;
    } else {
      throw new Error("Chaque ligne doit avoir une prestation ou un produit.");
    }
  }
  if (Object.keys(cart).length === 0) throw new Error("Panier vide.");
  return JSON.stringify(cart);
}

export async function resolveClientForPos(
  supabase: Db,
  tenantId: string,
  input: { client_id?: string; client_email?: string; client_name?: string },
) {
  return resolveClient(supabase, tenantId, input);
}

export async function fetchPosContext(supabase: Db, tenantId: string) {
  const [session, sales, giftCards, creditNotes] = await Promise.all([
    supabase
      .from("inst_cash_sessions")
      .select("id, status, opening_float_cents, opened_at")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("inst_sales")
      .select("id, ticket_number, total_cents, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("inst_gift_cards")
      .select("code, balance_cents, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(10),
    supabase
      .from("inst_credit_notes")
      .select("credit_number, remaining_cents, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(10),
  ]);

  return {
    openSession: session.data,
    recentSales: sales.data ?? [],
    giftCards: giftCards.data ?? [],
    creditNotes: creditNotes.data ?? [],
  };
}

/** Traduit les codes d'erreur checkout en messages lisibles. */
export function posCheckoutErrorMessage(code: string): string {
  const map: Record<string, string> = {
    invalid_cart: "Panier invalide.",
    empty_cart: "Panier vide.",
    invalid_amount: "Montant invalide.",
    no_payments: "Aucun paiement.",
    overpaid: "Montant payé supérieur au total.",
    no_open_session: "Aucune session caisse ouverte.",
    gift_card_invalid: "Bon cadeau invalide.",
    gift_card_insufficient: "Solde bon cadeau insuffisant.",
    gift_card_expired: "Bon cadeau expiré.",
    gift_card_code_required: "Code bon cadeau requis.",
    credit_note_invalid: "Avoir invalide.",
    credit_note_insufficient: "Solde avoir insuffisant.",
    credit_note_expired: "Avoir expiré.",
    credit_note_ref_required: "Référence avoir requise.",
    sale_not_found: "Vente introuvable.",
    sale_not_partial: "Cette vente n'a pas de solde restant.",
    sale_error: "Erreur lors de l'enregistrement de la vente.",
  };
  if (code.startsWith("payment_method_disabled:")) {
    return `Moyen de paiement désactivé : ${code.split(":")[1]}`;
  }
  return map[code] ?? code;
}
