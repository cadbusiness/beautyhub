export interface TenantIdentifier {
  /** Hote normalise (sans port). Sert au match par domaine custom. */
  host: string;
  /** Slug de sous-domaine si present (ex: "bob" pour bob.beautyhub.app). */
  slug: string | null;
}

/**
 * Determine comment resoudre le tenant a partir de l'hote de la requete.
 * - sous-domaine du domaine racine -> slug
 * - sinon -> domaine custom (match par host)
 */
export function parseTenantIdentifier(
  rawHost: string,
  rawRootDomain: string,
): TenantIdentifier {
  const host = stripPort(rawHost).toLowerCase();
  const root = stripPort(rawRootDomain).toLowerCase();

  if (host === root || host === `www.${root}`) {
    return { host, slug: null };
  }

  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, host.length - root.length - 1);
    const slug = sub.split(".")[0];
    if (slug && slug !== "www") return { host, slug };
    return { host, slug: null };
  }

  // Domaine custom: on resoudra par host.
  return { host, slug: null };
}

function stripPort(value: string): string {
  return value.split(":")[0];
}
