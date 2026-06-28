export const locales = ["fr", "nl", "en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Fuseau pour dates/heures affichées (aligne SSR Vercel UTC et navigateur client). */
export const defaultTimeZone = "Europe/Paris";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeLabels: Record<Locale, string> = {
  fr: "Français",
  nl: "Nederlands",
  en: "English",
  es: "Español",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function resolveLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const preferred = header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      return { tag: tag.toLowerCase().split("-")[0], q: qPart ? Number(qPart) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of preferred) {
    if (isLocale(tag)) return tag;
  }

  return defaultLocale;
}
