import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { translateQuotaError } from "@/lib/i18n/quota";
import { getWooCredentialsForTenant, WooClient, type WooCustomer } from "@/lib/woocommerce";
import { deriveWooCustomerNames } from "@/lib/woocommerce/customer-names";
import { findOrCreateClientFromExternal, type DedupMatchKind } from "@/lib/institut/clients-dedup";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 100;

function customerAsDedupInput(customer: WooCustomer, tenantId: string) {
  const email =
    (typeof customer.email === "string" && customer.email.trim()) ||
    (typeof customer.billing?.email === "string" && customer.billing.email.trim()) ||
    null;
  const phone =
    (typeof customer.billing?.phone === "string" && customer.billing.phone.trim()) || null;
  const { firstName, lastName } = deriveWooCustomerNames(customer);

  return {
    tenantId,
    source: "woo" as const,
    externalId: String(customer.id),
    email,
    phone,
    firstName,
    lastName,
    extraTags: ["WooCommerce"],
    metadata: {
      woo_customer_id: customer.id,
      woo_username: customer.username ?? null,
      woo_date_created: customer.date_created ?? null,
      woo_billing: customer.billing
        ? {
            city: customer.billing.city ?? null,
            postcode: customer.billing.postcode ?? null,
            country: customer.billing.country ?? null,
          }
        : null,
    },
  };
}

/**
 * GET : renvoie un résumé (nombre total de customers Woo côté source, sans mutation).
 * Utilisé par le dialog pour afficher le compteur avant de lancer l'import.
 *
 * Ne bloque **jamais** l'import si le count échoue : on renvoie toujours 200 avec
 * un `warning`. L'UI peut ainsi proposer un « Continuer sans compter » et lancer
 * les POST de pagination sans dépendre du total connu.
 */
export async function GET(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    // Utilise le client user-authenticated (RLS via `connections_access`)
    // pour éviter de dépendre de SUPABASE_SERVICE_ROLE_KEY côté import.
    const supabase = await createClient();
    const creds = await getWooCredentialsForTenant(session.tenant.id, supabase);
    if (!creds) {
      return NextResponse.json({ error: "no_woo_connection" }, { status: 400 });
    }
    const client = new WooClient(creds);
    try {
      const total = await client.countCustomers();
      return NextResponse.json({ total, storeUrl: creds.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[institut-clients-import-woo:GET] count failed", message);
      return NextResponse.json({
        total: null,
        storeUrl: creds.url,
        warning: message,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[institut-clients-import-woo:GET] unexpected", message);
    return NextResponse.json({
      total: null,
      storeUrl: null,
      warning: message,
    });
  }
}

/**
 * POST : traite **UNE seule page** de customers Woo par requête.
 *
 * Cette approche page-par-requête est indispensable pour deux raisons :
 *   1. Résilience aux timeouts Vercel (60s sur Hobby, 5 min sur Pro).
 *      Le client peut orchestrer 5000 customers en 50 requêtes sans jamais
 *      dépasser un timeout individuel.
 *   2. Reprise possible : le client peut retenter une page si elle échoue,
 *      sans reperdre les 4900 déjà traitées.
 *
 * Corps : `{ page: number }` (1-indexé). Réponse : `{ page, batchSize,
 * hasMore, created, matched, errors, quotaBlocked }`.
 */
export async function POST(request: Request) {
  const session = await requireInstitutApi(request);
  const supabase = await createClient();
  const creds = await getWooCredentialsForTenant(session.tenant.id, supabase);
  if (!creds) {
    return NextResponse.json({ error: "no_woo_connection" }, { status: 400 });
  }

  let body: { page?: number } = {};
  try {
    body = ((await request.json()) as { page?: number }) ?? {};
  } catch {
    body = {};
  }

  const page = Math.max(1, Math.floor(Number(body.page ?? 1)));
  const client = new WooClient(creds);

  const result = {
    page,
    batchSize: 0,
    hasMore: false,
    created: 0,
    matched: { external: 0, phone: 0, email: 0, name: 0 } as Record<
      Exclude<DedupMatchKind, "created">,
      number
    >,
    errors: [] as string[],
    quotaBlocked: false,
  };

  let batch: WooCustomer[] = [];
  try {
    batch = await client.listCustomers(page, PAGE_SIZE);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[institut-clients-import-woo:POST] page ${page} fetch failed`, msg);
    return NextResponse.json(
      { ...result, errors: [msg], hasMore: false },
      { status: 502 },
    );
  }

  result.batchSize = batch.length;
  result.hasMore = batch.length === PAGE_SIZE;

  if (batch.length === 0) {
    return NextResponse.json(result);
  }

  try {
    await assertQuota(session.tenant.id, "clients", batch.length);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      const message = await translateQuotaError(err);
      result.errors.push(message);
      result.quotaBlocked = true;
      result.hasMore = false;
      return NextResponse.json(result);
    }
    throw err;
  }

  for (const customer of batch) {
    try {
      const dedupResult = await findOrCreateClientFromExternal(
        supabase,
        customerAsDedupInput(customer, session.tenant.id),
      );
      if (dedupResult.matched === "created") {
        result.created += 1;
      } else {
        result.matched[dedupResult.matched] += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[institut-clients-import-woo:POST] customer ${customer.id}`, msg);
      result.errors.push(`customer ${customer.id}: ${msg}`);
    }
  }

  return NextResponse.json(result);
}
