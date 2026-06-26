import { headers } from "next/headers";

/** Origine publique de la requete courante (pour les URLs de retour Stripe). */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
