import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError } from "@/lib/quota";
import { translateQuotaError } from "@/lib/i18n/quota";
import { getWooCredentialsForTenant, WooClient, type WooCustomer } from "@/lib/woocommerce";
import { findOrCreateClientFromExternal, type DedupMatchKind } from "@/lib/institut/clients-dedup";

export const runtime = "nodejs";
export const maxDuration = 300;

const PAGE_SIZE = 100;

function encoder() {
  return new TextEncoder();
}

function encodeEvent(payload: Record<string, unknown>): Uint8Array {
  return encoder().encode(JSON.stringify(payload) + "\n");
}

function customerAsDedupInput(customer: WooCustomer, tenantId: string) {
  const email =
    (typeof customer.email === "string" && customer.email.trim()) ||
    (typeof customer.billing?.email === "string" && customer.billing.email.trim()) ||
    null;
  const phone =
    (typeof customer.billing?.phone === "string" && customer.billing.phone.trim()) || null;
  const firstName =
    (typeof customer.first_name === "string" && customer.first_name.trim()) ||
    (typeof customer.billing?.first_name === "string" && customer.billing.first_name.trim()) ||
    null;
  const lastName =
    (typeof customer.last_name === "string" && customer.last_name.trim()) ||
    (typeof customer.billing?.last_name === "string" && customer.billing.last_name.trim()) ||
    null;

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
 */
export async function GET() {
  try {
    const session = await requireModule("institut");
    const creds = await getWooCredentialsForTenant(session.tenant.id);
    if (!creds) {
      return NextResponse.json({ error: "no_woo_connection" }, { status: 400 });
    }
    const client = new WooClient(creds);
    const total = await client.countCustomers();
    return NextResponse.json({ total, storeUrl: creds.url });
  } catch (error) {
    console.error("[institut-clients-import-woo:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "status_failed" },
      { status: 500 },
    );
  }
}

/**
 * POST : lance l'import des customers Woo. Renvoie un flux NDJSON avec
 * une ligne `{ kind: "progress", ... }` toutes les X customers, puis une
 * ligne finale `{ kind: "done", ... }`.
 *
 * Corps optionnel : { fromPage?: number } pour reprendre.
 */
export async function POST(request: Request) {
  const session = await requireModule("institut");
  const supabase = await createClient();
  const creds = await getWooCredentialsForTenant(session.tenant.id);
  if (!creds) {
    return NextResponse.json({ error: "no_woo_connection" }, { status: 400 });
  }

  let body: { fromPage?: number } = {};
  try {
    body = ((await request.json()) as { fromPage?: number }) ?? {};
  } catch {
    body = {};
  }

  const client = new WooClient(creds);

  // On s'assure que le tenant a de la marge côté quota (approximation : on
  // check pour PAGE_SIZE créations à chaque page, mais on ne bloque pas
  // l'import complet a priori — la dedup peut aboutir à un simple match).
  let totalCustomers = 0;
  try {
    totalCustomers = await client.countCustomers();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "woo_count_failed" },
      { status: 500 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encodeEvent(payload));
      };

      const aggregate = {
        processed: 0,
        created: 0,
        matched: { external: 0, phone: 0, email: 0, name: 0 } as Record<
          Exclude<DedupMatchKind, "created">,
          number
        >,
        errors: [] as string[],
      };

      send({ kind: "start", total: totalCustomers });

      let page = Math.max(1, body.fromPage ?? 1);
      let hasMore = true;
      let quotaBlocked = false;

      while (hasMore && !quotaBlocked) {
        let batch: WooCustomer[] = [];
        try {
          batch = await client.listCustomers(page, PAGE_SIZE);
        } catch (err) {
          aggregate.errors.push(
            `page ${page}: ${err instanceof Error ? err.message : String(err)}`,
          );
          send({ kind: "progress", ...aggregate, page });
          break;
        }
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        // Quota : on demande de la place pour le pire cas (batch entier = créations)
        try {
          await assertQuota(session.tenant.id, "clients", batch.length);
        } catch (err) {
          if (err instanceof QuotaExceededError) {
            const message = await translateQuotaError(err);
            aggregate.errors.push(message);
            quotaBlocked = true;
            send({ kind: "progress", ...aggregate, page, quotaBlocked: true });
            break;
          }
          throw err;
        }

        for (const customer of batch) {
          try {
            const result = await findOrCreateClientFromExternal(
              supabase,
              customerAsDedupInput(customer, session.tenant.id),
            );
            if (result.matched === "created") {
              aggregate.created += 1;
            } else {
              aggregate.matched[result.matched] += 1;
            }
          } catch (err) {
            aggregate.errors.push(
              `customer ${customer.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          aggregate.processed += 1;
        }

        send({ kind: "progress", ...aggregate, page });

        if (batch.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page += 1;
        }
      }

      send({ kind: "done", ...aggregate, pagesProcessed: page });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
