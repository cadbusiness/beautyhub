/** Utilitaires partagés site-pages (sans dépendance circulaire). */
export function blockId(): string {
  return crypto.randomUUID();
}
