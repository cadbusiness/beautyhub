/** URL publique de l'app Next.js (webhooks, liens plugin, redirects Stripe…). */
export function apiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Domaine de production stable (ex. beautyhub-two.vercel.app) — non protégé par
  // la Deployment Protection Vercel, contrairement à VERCEL_URL (URL éphémère du
  // déploiement qui renvoie 401 "Protected deployment" aux appels externes).
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/\/$/, "")}`;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
