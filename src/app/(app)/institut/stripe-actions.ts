"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import {
  disconnectTenantConnection,
  getTenantConnectionStatus,
  saveTenantConnection,
} from "@/lib/connections";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import {
  fetchStripeAccountStatus,
  getStripeAccountForTenant,
  STRIPE_CONNECT_PROVIDER,
} from "@/lib/stripe/index";
import { getRequestOrigin } from "@/lib/stripe/origin";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function getOrCreateAccountId(tenantId: string): Promise<string> {
  const existing = await getTenantConnectionStatus(tenantId, STRIPE_CONNECT_PROVIDER);
  const accountId =
    existing?.config?.accountId && typeof existing.config.accountId === "string"
      ? existing.config.accountId
      : null;

  if (accountId) return accountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: { card_payments: { requested: true } },
    metadata: { tenant_id: tenantId },
  });

  await saveTenantConnection(
    tenantId,
    STRIPE_CONNECT_PROVIDER,
    {},
    { accountId: account.id, chargesEnabled: false, detailsSubmitted: false },
    "disconnected",
  );

  return account.id;
}

/** Synchronise le statut Connect depuis Stripe et met a jour la connexion tenant. */
export async function syncStripeConnectStatus(tenantId: string): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
}> {
  const status = await getTenantConnectionStatus(tenantId, STRIPE_CONNECT_PROVIDER);
  const accountId =
    status?.config?.accountId && typeof status.config.accountId === "string"
      ? status.config.accountId
      : null;
  if (!accountId) return { connected: false, chargesEnabled: false };

  const { chargesEnabled, detailsSubmitted } =
    await fetchStripeAccountStatus(accountId);

  await saveTenantConnection(
    tenantId,
    STRIPE_CONNECT_PROVIDER,
    {},
    { accountId, chargesEnabled, detailsSubmitted },
    chargesEnabled ? "connected" : "disconnected",
  );

  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
  return { connected: chargesEnabled, chargesEnabled };
}

/** Demarre ou reprend l'onboarding Stripe Connect Express. */
export async function startStripeConnect(): Promise<void> {
  const session = await requireModule("institut");
  if (!isStripeConfigured()) {
    redirect("/institut/parametres?stripe=missing_key");
  }

  const accountId = await getOrCreateAccountId(session.tenant.id);
  const origin = await getRequestOrigin();
  const stripe = getStripe();

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/institut/parametres?stripe=refresh`,
    return_url: `${origin}/institut/parametres?stripe=return`,
    type: "account_onboarding",
  });

  redirect(link.url);
}

export async function disconnectStripe(): Promise<void> {
  const session = await requireModule("institut");
  await disconnectTenantConnection(session.tenant.id, STRIPE_CONNECT_PROVIDER);
  revalidatePath("/institut/parametres");
  revalidatePath("/institut/caisse");
}

export interface CartLine {
  productId: string;
  qty: number;
}

export interface PaymentIntentResult {
  error?: string;
  clientSecret?: string;
  paymentIntentId?: string;
  totalCents?: number;
}

/** Cree un PaymentIntent sur le compte Connect du tenant. */
export async function createStripePaymentIntent(
  cartJson: string,
): Promise<PaymentIntentResult> {
  const session = await requireModule("institut");
  const account = await getStripeAccountForTenant(session.tenant.id);
  if (!account) {
    return { error: "Stripe Connect non configure pour cet institut." };
  }

  let cart: Record<string, number>;
  try {
    cart = JSON.parse(cartJson);
  } catch {
    return { error: "Panier invalide." };
  }

  const productIds = Object.keys(cart);
  if (productIds.length === 0) return { error: "Panier vide." };

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("inst_products")
    .select("id, price_cents")
    .eq("tenant_id", session.tenant.id)
    .in("id", productIds);
  if (!products?.length) return { error: "Produits introuvables." };

  let total = 0;
  for (const p of products) {
    const qty = Math.max(1, Number(cart[p.id]) || 1);
    total += p.price_cents * qty;
  }
  if (total <= 0) return { error: "Montant invalide." };

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: total,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { tenant_id: session.tenant.id },
    },
    { stripeAccount: account.accountId },
  );

  if (!paymentIntent.client_secret) {
    return { error: "Impossible de creer le paiement Stripe." };
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    totalCents: total,
  };
}

/** Finalise une vente apres confirmation du PaymentIntent Stripe. */
export async function finalizeStripeCheckout(
  paymentIntentId: string,
  cartJson: string,
  clientId: string | null,
): Promise<ActionResult> {
  const session = await requireModule("institut");
  const account = await getStripeAccountForTenant(session.tenant.id);
  if (!account) return { error: "Stripe Connect non configure." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {},
    { stripeAccount: account.accountId },
  );
  if (pi.status !== "succeeded") {
    return { error: "Paiement non confirme." };
  }

  let cart: Record<string, number>;
  try {
    cart = JSON.parse(cartJson);
  } catch {
    return { error: "Panier invalide." };
  }

  const productIds = Object.keys(cart);
  if (productIds.length === 0) return { error: "Panier vide." };

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("inst_products")
    .select("id, woo_id, name, price_cents")
    .eq("tenant_id", session.tenant.id)
    .in("id", productIds);
  if (!products?.length) return { error: "Produits introuvables." };

  let total = 0;
  const items = products.map((p) => {
    const qty = Math.max(1, Number(cart[p.id]) || 1);
    total += p.price_cents * qty;
    return { product: p, qty };
  });

  if (total !== pi.amount) {
    return { error: "Montant du panier incompatible avec le paiement." };
  }

  const { data: existingSale } = await supabase
    .from("inst_sales")
    .select("id")
    .eq("tenant_id", session.tenant.id)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (existingSale) {
    return { ok: true, message: "Vente deja enregistree." };
  }

  const { data: sale, error: saleErr } = await supabase
    .from("inst_sales")
    .insert({
      tenant_id: session.tenant.id,
      client_id: clientId,
      total_cents: total,
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
    })
    .select("id")
    .single();
  if (saleErr || !sale) return { error: saleErr?.message ?? "Erreur vente." };

  const { error: itemsErr } = await supabase.from("inst_sale_items").insert(
    items.map((i) => ({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      product_id: i.product.id,
      name: i.product.name,
      quantity: i.qty,
      unit_price_cents: i.product.price_cents,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  revalidatePath("/institut/caisse");
  return { ok: true, message: "Paiement carte enregistre." };
}
