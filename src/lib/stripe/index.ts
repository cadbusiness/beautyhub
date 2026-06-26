import { resolveConnection } from "@/lib/connections";
import { getStripe } from "./client";

export const STRIPE_CONNECT_PROVIDER = "stripe_connect";

export interface StripeConnectConfig {
  accountId?: string;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
}

/** Compte Stripe Connect Express du tenant (cascade tenant -> brand -> plateforme). */
export async function getStripeAccountForTenant(
  tenantId: string,
): Promise<{ accountId: string; config: StripeConnectConfig } | null> {
  const conn = await resolveConnection(tenantId, STRIPE_CONNECT_PROVIDER);
  if (!conn || conn.status !== "connected") return null;

  const accountId =
    typeof conn.config.accountId === "string" ? conn.config.accountId : null;
  if (!accountId) return null;

  return {
    accountId,
    config: conn.config as StripeConnectConfig,
  };
}

/** Verifie l'etat du compte Connect chez Stripe et renvoie charges_enabled. */
export async function fetchStripeAccountStatus(accountId: string): Promise<{
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}
