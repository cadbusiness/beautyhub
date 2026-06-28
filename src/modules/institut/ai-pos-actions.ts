import { z } from "zod";
import { defineAction } from "../types";
import {
  computeSessionSnapshot,
  getOpenCashSession,
  nextReportNumber,
} from "@/lib/institut/pos-session";
import {
  executeBalancePayment,
  executePosCheckout,
  type SalePaymentInput,
} from "@/lib/institut/pos-checkout";
import { issueGiftCard, createCreditNoteFromSale } from "@/lib/institut/pos-vouchers";
import { getPosSettings } from "@/lib/institut/pos-settings";
import type { Json } from "@/lib/db/database.types";
import {
  buildCartJson,
  eurosToCents,
  fetchPosContext,
  posCheckoutErrorMessage,
  resolveClientForPos,
  resolveSale,
} from "./ai-pos-helpers";
import { resolveStaff } from "./ai-helpers";

const cartLineSchema = z.object({
  service_name: z.string().optional(),
  product_name: z.string().optional(),
  service_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  quantity: z.number().int().min(1).default(1),
});

const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "stripe",
  "transfer",
  "gift_card",
  "credit_note",
  "other",
]);

async function wrapPosCheckout(
  ctx: { supabase: Parameters<typeof executePosCheckout>[0]; tenantId: string },
  fn: () => Promise<unknown>,
) {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("Prestation introuvable") || msg.includes("Produit introuvable")) {
      throw e;
    }
    throw new Error(posCheckoutErrorMessage(msg));
  }
}

export const institutPosAiActions = [
  defineAction({
    name: "institut.pos_session_status",
    description: "Affiche l'état de la session caisse (ouverte/fermée) et un résumé des ventes.",
    parameters: z.object({}),
    requiredRole: "staff",
    handler: async (ctx) => {
      const pos = await fetchPosContext(ctx.supabase, ctx.tenantId);
      if (!pos.openSession) {
        return { status: "closed", message: "Aucune session caisse ouverte." };
      }
      const snapshot = await computeSessionSnapshot(
        ctx.supabase,
        ctx.tenantId,
        pos.openSession.id,
        "x",
      );
      return {
        status: "open",
        session_id: pos.openSession.id,
        opened_at: pos.openSession.opened_at,
        opening_float_cents: pos.openSession.opening_float_cents,
        snapshot,
      };
    },
  }),

  defineAction({
    name: "institut.pos_open_session",
    description: "Ouvre une session de caisse avec un fond de caisse initial.",
    parameters: z.object({
      opening_float_euros: z
        .number()
        .min(0)
        .default(0)
        .describe("Fond de caisse initial en euros"),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) => {
      const existing = await getOpenCashSession(ctx.supabase, ctx.tenantId);
      if (existing) throw new Error("Une session caisse est déjà ouverte.");

      const { data, error } = await ctx.supabase
        .from("inst_cash_sessions")
        .insert({
          tenant_id: ctx.tenantId,
          opening_float_cents: eurosToCents(params.opening_float_euros),
          status: "open",
        })
        .select("id, opening_float_cents, opened_at")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_close_session",
    description: "Clôture la session caisse (rapport Z) avec le montant espèces compté.",
    parameters: z.object({
      counted_cash_euros: z.number().min(0).describe("Espèces comptées en caisse en euros"),
      notes: z.string().optional(),
    }),
    requiredRole: "tenant_owner",
    confirm: true,
    handler: async (ctx, params) => {
      const cashSession = await getOpenCashSession(ctx.supabase, ctx.tenantId);
      if (!cashSession) throw new Error("Aucune session caisse ouverte.");

      const countedCash = eurosToCents(params.counted_cash_euros);
      const snapshot = await computeSessionSnapshot(
        ctx.supabase,
        ctx.tenantId,
        cashSession.id,
        "z",
      );
      const reportNumber = await nextReportNumber(ctx.supabase, ctx.tenantId, "z", "Z");
      const variance = countedCash - snapshot.expected_cash_cents;

      const { data: report, error: reportErr } = await ctx.supabase
        .from("inst_cash_reports")
        .insert({
          tenant_id: ctx.tenantId,
          session_id: cashSession.id,
          report_type: "z",
          report_number: reportNumber,
          snapshot: {
            ...snapshot,
            closing_counted_cents: countedCash,
            variance_cents: variance,
          } as unknown as Json,
        })
        .select("id")
        .single();
      if (reportErr || !report) throw new Error(reportErr?.message ?? "report_failed");

      const { error: closeErr } = await ctx.supabase
        .from("inst_cash_sessions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closing_counted_cents: countedCash,
          closing_expected_cents: snapshot.expected_cash_cents,
          closing_variance_cents: variance,
          z_report_number: reportNumber,
          notes: params.notes ?? null,
        })
        .eq("id", cashSession.id);
      if (closeErr) throw new Error(closeErr.message);

      return {
        report_number: reportNumber,
        variance_cents: variance,
        expected_cash_cents: snapshot.expected_cash_cents,
        counted_cash_cents: countedCash,
      };
    },
  }),

  defineAction({
    name: "institut.pos_generate_x_report",
    description: "Génère un rapport X (intermédiaire) de la session caisse ouverte.",
    parameters: z.object({}),
    requiredRole: "staff",
    handler: async (ctx) => {
      const cashSession = await getOpenCashSession(ctx.supabase, ctx.tenantId);
      if (!cashSession) throw new Error("Aucune session caisse ouverte.");

      const snapshot = await computeSessionSnapshot(
        ctx.supabase,
        ctx.tenantId,
        cashSession.id,
        "x",
      );
      const reportNumber = await nextReportNumber(ctx.supabase, ctx.tenantId, "x", "X");

      const { data, error } = await ctx.supabase
        .from("inst_cash_reports")
        .insert({
          tenant_id: ctx.tenantId,
          session_id: cashSession.id,
          report_type: "x",
          report_number: reportNumber,
          snapshot: snapshot as unknown as Json,
        })
        .select("id, report_number")
        .single();
      if (error || !data) throw new Error(error?.message ?? "report_failed");

      return { report_id: data.id, report_number: data.report_number, snapshot };
    },
  }),

  defineAction({
    name: "institut.pos_add_movement",
    description: "Enregistre un mouvement de caisse (entrée, sortie ou dépense).",
    parameters: z.object({
      movement_type: z.enum(["in", "out", "expense"]).describe("in=entrée, out=sortie, expense=dépense"),
      amount_euros: z.number().positive(),
      reason: z.string().min(1),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) => {
      const cashSession = await getOpenCashSession(ctx.supabase, ctx.tenantId);
      if (!cashSession) throw new Error("Aucune session caisse ouverte.");

      const { data, error } = await ctx.supabase
        .from("inst_cash_movements")
        .insert({
          tenant_id: ctx.tenantId,
          session_id: cashSession.id,
          movement_type: params.movement_type,
          amount_cents: eurosToCents(params.amount_euros),
          reason: params.reason.trim(),
        })
        .select("id, movement_type, amount_cents, reason")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_list_sales",
    description: "Liste les ventes caisse récentes ou recherche par numéro de ticket.",
    parameters: z.object({
      limit: z.number().int().min(1).max(50).default(20),
      ticket_number: z.string().optional(),
      status: z.enum(["paid", "partial", "refunded"]).optional(),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      let q = ctx.supabase
        .from("inst_sales")
        .select(
          "id, ticket_number, total_cents, amount_paid_cents, status, payment_method, created_at, client:clients(full_name)",
        )
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(params.limit);

      if (params.ticket_number) {
        q = q.eq("ticket_number", params.ticket_number.trim().toUpperCase());
      }
      if (params.status) q = q.eq("status", params.status);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_checkout",
    description:
      "Enregistre une vente caisse avec prestations/produits par nom et un ou plusieurs paiements.",
    parameters: z.object({
      lines: z
        .array(cartLineSchema)
        .min(1)
        .describe("Lignes du panier (prestation ou produit + quantité)"),
      payment_method: paymentMethodSchema.default("cash"),
      payment_euros: z
        .number()
        .positive()
        .optional()
        .describe("Montant payé en euros (omis = total du panier)"),
      gift_card_code: z.string().optional(),
      credit_note_number: z.string().optional(),
      client_email: z.string().optional(),
      client_name: z.string().optional(),
      staff_name: z.string().optional(),
      cart_discount_euros: z.number().min(0).default(0),
      notes: z.string().optional(),
      partial: z
        .boolean()
        .default(false)
        .describe("true pour enregistrer un acompte partiel"),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) =>
      wrapPosCheckout(ctx, async () => {
        const cartJson = await buildCartJson(ctx.supabase, ctx.tenantId, params.lines);
        const client = params.client_email || params.client_name
          ? await resolveClientForPos(ctx.supabase, ctx.tenantId, params)
          : null;
        const staff = params.staff_name
          ? await resolveStaff(ctx.supabase, ctx.tenantId, { staff_name: params.staff_name })
          : null;

        const settings = await getPosSettings(ctx.supabase, ctx.tenantId);
        const { parsePosCart, resolveCartLines } = await import("@/lib/institut/pos");
        const { computeCartTotals } = await import("@/lib/institut/pos-totals");
        const { vatRateForLineType } = await import("@/lib/institut/pos-settings");

        const cart = parsePosCart(cartJson);
        const lines = await resolveCartLines(ctx.supabase, ctx.tenantId, cart);
        const totals = computeCartTotals(lines, {
          priceDisplay: settings.price_display,
          vatRateForType: (type) => vatRateForLineType(settings, type),
          cartDiscountCents: eurosToCents(params.cart_discount_euros),
        });

        let payAmount = params.payment_euros
          ? eurosToCents(params.payment_euros)
          : totals.total_cents;
        if (params.partial && !params.payment_euros) {
          throw new Error("Précisez payment_euros pour un acompte partiel.");
        }
        if (!params.partial && payAmount < totals.total_cents) {
          payAmount = totals.total_cents;
        }

        const payments: SalePaymentInput[] = [
          {
            method: params.payment_method,
            amount_cents: payAmount,
            reference:
              params.payment_method === "gift_card"
                ? params.gift_card_code
                : params.payment_method === "credit_note"
                  ? params.credit_note_number
                  : undefined,
          },
        ];

        const result = await executePosCheckout(ctx.supabase, ctx.tenantId, {
          cartJson,
          clientId: client?.id ?? null,
          staffId: staff?.id ?? null,
          notes: params.notes,
          cartDiscountCents: eurosToCents(params.cart_discount_euros),
          payments,
        });

        return {
          sale_id: result.saleId,
          ticket_number: result.ticketNumber,
          status: result.status,
          total_euros: result.totalCents / 100,
          paid_euros: result.amountPaidCents / 100,
        };
      }),
  }),

  defineAction({
    name: "institut.pos_pay_balance",
    description: "Encaisse le solde restant d'une vente partielle (acompte).",
    parameters: z.object({
      sale_id: z.string().uuid().optional(),
      ticket_number: z.string().optional(),
      payment_method: paymentMethodSchema.default("cash"),
      payment_euros: z.number().positive(),
      gift_card_code: z.string().optional(),
      credit_note_number: z.string().optional(),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) =>
      wrapPosCheckout(ctx, async () => {
        const sale = await resolveSale(ctx.supabase, ctx.tenantId, params);
        if (!sale) throw new Error("Vente introuvable.");

        const payments: SalePaymentInput[] = [
          {
            method: params.payment_method,
            amount_cents: eurosToCents(params.payment_euros),
            reference:
              params.payment_method === "gift_card"
                ? params.gift_card_code
                : params.payment_method === "credit_note"
                  ? params.credit_note_number
                  : undefined,
          },
        ];

        const result = await executeBalancePayment(
          ctx.supabase,
          ctx.tenantId,
          sale.id,
          payments,
        );

        return {
          sale_id: result.saleId,
          ticket_number: result.ticketNumber,
          status: result.status,
          total_euros: result.totalCents / 100,
          paid_euros: result.amountPaidCents / 100,
        };
      }),
  }),

  defineAction({
    name: "institut.pos_issue_gift_card",
    description: "Émet un bon cadeau avec un montant et un bénéficiaire optionnel.",
    parameters: z.object({
      amount_euros: z.number().positive(),
      recipient_name: z.string().optional(),
      client_email: z.string().optional(),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) => {
      const client = params.client_email
        ? await resolveClientForPos(ctx.supabase, ctx.tenantId, {
            client_email: params.client_email,
          })
        : null;

      const card = await issueGiftCard(ctx.supabase, ctx.tenantId, {
        amountCents: eurosToCents(params.amount_euros),
        clientId: client?.id ?? null,
        recipientName: params.recipient_name,
      });

      return {
        id: card.id,
        code: card.code,
        amount_euros: params.amount_euros,
      };
    },
  }),

  defineAction({
    name: "institut.pos_list_gift_cards",
    description: "Liste les bons cadeaux actifs.",
    parameters: z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_gift_cards")
        .select("id, code, balance_cents, initial_balance_cents, recipient_name, status, expires_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(params.limit);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_create_credit_note",
    description: "Crée un avoir lié à une vente existante.",
    parameters: z.object({
      sale_id: z.string().uuid().optional(),
      ticket_number: z.string().optional(),
      amount_euros: z.number().positive(),
      reason: z.string().optional(),
    }),
    requiredRole: "tenant_owner",
    confirm: true,
    handler: async (ctx, params) => {
      const sale = await resolveSale(ctx.supabase, ctx.tenantId, params);
      if (!sale) throw new Error("Vente introuvable.");

      try {
        const note = await createCreditNoteFromSale(ctx.supabase, ctx.tenantId, {
          saleId: sale.id,
          amountCents: eurosToCents(params.amount_euros),
          reason: params.reason,
        });
        return {
          id: note.id,
          credit_number: note.creditNumber,
          amount_euros: params.amount_euros,
        };
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "credit_amount_invalid") throw new Error("Montant avoir invalide.");
        if (msg === "sale_not_found") throw new Error("Vente introuvable.");
        throw e;
      }
    },
  }),

  defineAction({
    name: "institut.pos_list_credit_notes",
    description: "Liste les avoirs actifs.",
    parameters: z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_credit_notes")
        .select("id, credit_number, amount_cents, remaining_cents, reason, status, expires_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(params.limit);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_list_products",
    description: "Liste les produits internes vendus en caisse.",
    parameters: z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_products")
        .select("id, name, sku, price_cents, stock_quantity, status")
        .eq("tenant_id", ctx.tenantId)
        .eq("source", "internal")
        .order("name")
        .limit(params.limit);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_create_product",
    description: "Crée un produit interne vendable en caisse.",
    parameters: z.object({
      name: z.string().min(1),
      price_euros: z.number().min(0),
      sku: z.string().optional(),
      stock_quantity: z.number().int().min(0).optional(),
    }),
    requiredRole: "tenant_owner",
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_products")
        .insert({
          tenant_id: ctx.tenantId,
          name: params.name.trim(),
          sku: params.sku?.trim() || null,
          price_cents: eurosToCents(params.price_euros),
          stock_quantity: params.stock_quantity ?? null,
          source: "internal",
          status: "active",
        })
        .select("id, name, price_cents, sku")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.pos_get_settings",
    description: "Affiche un résumé des paramètres caisse (TVA, moyens de paiement, session obligatoire).",
    parameters: z.object({}),
    requiredRole: "staff",
    handler: async (ctx) => {
      const settings = await getPosSettings(ctx.supabase, ctx.tenantId);
      return {
        country_code: settings.country_code,
        currency: settings.currency,
        price_display: settings.price_display,
        fiscal_regime: settings.fiscal_regime,
        require_open_session: settings.require_open_session,
        payment_methods: settings.payment_methods,
        ticket_prefix: settings.ticket_prefix,
      };
    },
  }),
];
