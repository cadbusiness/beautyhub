"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/guards";
import { requireInstitutSettingsModule, COMPTE_INSTITUT_STRIPE } from "@/lib/auth/institut-settings";
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
import { parsePosCart, resolveCartLines } from "@/lib/institut/pos";
import { processPosCheckout } from "./caisse-actions";

export interface ActionResult {
  error?: string;
  ok?: boolean;
  message?: string;
}

async function translateCartLineError(error: unknown): Promise<string> {
  const t = await getTranslations("institut.actions");
  const msg = (error as Error).message;
  const servicePrefix = "Prestation introuvable: ";
  const productPrefix = "Produit introuvable: ";
  if (msg.startsWith(servicePrefix)) {
    return t("serviceNotFoundInCart", { id: msg.slice(servicePrefix.length) });
  }
  if (msg.startsWith(productPrefix)) {
    return t("productNotFoundInCart", { id: msg.slice(productPrefix.length) });
  }
  return msg;
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

  revalidatePath(COMPTE_INSTITUT_STRIPE);
  revalidatePath("/compte/institut/woocommerce");
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/historique");
  return { connected: chargesEnabled, chargesEnabled };
}

/** Demarre ou reprend l'onboarding Stripe Connect Express. */
export async function startStripeConnect(): Promise<void> {
  const session = await requireInstitutSettingsModule();
  if (!isStripeConfigured()) {
    redirect(`${COMPTE_INSTITUT_STRIPE}?stripe=missing_key`);
  }

  const accountId = await getOrCreateAccountId(session.tenant.id);
  const origin = await getRequestOrigin();
  const stripe = getStripe();

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}${COMPTE_INSTITUT_STRIPE}?stripe=refresh`,
    return_url: `${origin}${COMPTE_INSTITUT_STRIPE}?stripe=return`,
    type: "account_onboarding",
  });

  redirect(link.url);
}

export async function disconnectStripe(): Promise<void> {
  const session = await requireInstitutSettingsModule();
  await disconnectTenantConnection(session.tenant.id, STRIPE_CONNECT_PROVIDER);
  revalidatePath(COMPTE_INSTITUT_STRIPE);
  revalidatePath("/compte/institut/woocommerce");
  revalidatePath("/institut/caisse");
  revalidatePath("/institut/caisse/historique");
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
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const account = await getStripeAccountForTenant(session.tenant.id);
  if (!account) {
    return { error: t("stripeNotConfigured") };
  }

  let cart: Record<string, number>;
  try {
    cart = parsePosCart(cartJson);
  } catch {
    return { error: t("invalidCart") };
  }
  if (Object.keys(cart).length === 0) return { error: t("emptyCart") };

  const supabase = await createClient();
  let lines;
  try {
    lines = await resolveCartLines(supabase, session.tenant.id, cart);
  } catch (e) {
    return { error: await translateCartLineError(e) };
  }
  const total = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
  if (total <= 0) return { error: t("invalidAmount") };

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
    return { error: t("paymentCreateFailed") };
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
  const t = await getTranslations("institut.actions");
  const session = await requireModule("institut");
  const account = await getStripeAccountForTenant(session.tenant.id);
  if (!account) return { error: t("stripeNotConfiguredShort") };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {},
    { stripeAccount: account.accountId },
  );
  if (pi.status !== "succeeded") {
    return { error: t("paymentNotConfirmed") };
  }

  let cart: Record<string, number>;
  try {
    cart = parsePosCart(cartJson);
  } catch {
    return { error: t("invalidCart") };
  }

  let lines;
  try {
    const supabase = await createClient();
    lines = await resolveCartLines(supabase, session.tenant.id, cart);
  } catch (e) {
    return { error: await translateCartLineError(e) };
  }

  const total = lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
  if (total !== pi.amount) {
    return { error: t("cartAmountMismatch") };
  }

  return processPosCheckout(cartJson, clientId, "stripe", {
    stripePaymentIntentId: paymentIntentId,
  });
}
