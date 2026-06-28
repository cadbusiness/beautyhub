/** Préfixe court dérivé du nom de l'institut (ex. « Institut Demo » → `ins`). */
export function tenantClientIdPrefix(name: string, slug: string): string {
  const stopWords = new Set(["le", "la", "les", "de", "du", "des", "the", "and", "et"]);
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[\s\-_]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const word = words[0] ?? slug.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const prefix = word.slice(0, 3);
  return prefix.length >= 2 ? prefix : "cli";
}

export function formatClientLoginId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

export function parseClientLoginIdSequence(
  loginId: string,
  prefix: string,
): number | null {
  const match = loginId.trim().toLowerCase().match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return null;
  const seq = Number.parseInt(match[1], 10);
  return Number.isFinite(seq) ? seq : null;
}

export function isLegacyNumericLoginId(loginId: string): boolean {
  return /^\d{4,8}$/.test(loginId.trim());
}
