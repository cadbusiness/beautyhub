/**
 * Nom / prénom d'un customer WooCommerce.
 *
 * Utilisé par les 3 chemins qui créent des clients BH depuis Woo :
 *   1. Bulk import (/api/institut/clients/import-woo)
 *   2. Webhook `customer.created` / `customer.updated`
 *   3. Ingestion order.completed (`woo-order-sales.ts`)
 *
 * Woo renvoie très souvent `first_name = ""` / `last_name = ""` pour les
 * customers créés en checkout invité ou synchronisés depuis d'autres systèmes.
 * On applique donc une cascade de fallbacks pour ne jamais insérer un client
 * BH avec `full_name = null` quand une information exploitable est présente.
 */

export interface WooNameSource {
  /** Renvoyé par /customers ou l'objet root de order.billing. */
  first_name?: string | null;
  last_name?: string | null;
  /** Billing (l'objet `billing.*` de /customers ou de /orders). */
  billing?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  /** username Woo (uniquement sur /customers). */
  username?: string | null;
  /** email root (`/customers`) ou en fallback via billing.email. */
  email?: string | null;
}

function titleCasePiece(raw: string): string {
  return raw
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Extrait un prénom / nom raisonnable même quand Woo renvoie des champs vides :
 * fallback sur username (si ce n'est pas un pattern générique `user123` / UUID),
 * puis sur le préfixe de l'email (`marie.durand@gmail.com` → `Marie Durand`).
 *
 * Retourne `{ null, null }` uniquement quand aucune source exploitable n'existe
 * (pas de billing, username générique, email de type `no-reply@`).
 */
export function deriveWooCustomerNames(
  customer: WooNameSource,
): { firstName: string | null; lastName: string | null } {
  const firstName =
    trim(customer.first_name) || trim(customer.billing?.first_name);
  const lastName =
    trim(customer.last_name) || trim(customer.billing?.last_name);
  if (firstName || lastName) {
    return { firstName: firstName || null, lastName: lastName || null };
  }

  const username = trim(customer.username);
  if (
    username &&
    !/^user_?\d+$/i.test(username) &&
    !/^[a-f0-9-]{16,}$/i.test(username)
  ) {
    const nice = titleCasePiece(username);
    if (nice) return { firstName: nice, lastName: null };
  }

  const email = trim(customer.email) || trim(customer.billing?.email);
  if (email) {
    const prefix = email.split("@")[0] ?? "";
    if (
      prefix.length >= 2 &&
      /[a-z]/i.test(prefix) &&
      !/^(no-?reply|no-?email|admin|user_?\d+|contact|info|support)$/i.test(
        prefix,
      ) &&
      !/^\d+$/.test(prefix)
    ) {
      const nice = titleCasePiece(prefix);
      if (nice) return { firstName: nice, lastName: null };
    }
  }

  return { firstName: null, lastName: null };
}
