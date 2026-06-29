import { z } from "zod";

/** Audience de l'app mobile : équipe institut ou client final. */
export const mobileAudienceSchema = z.enum(["institut", "client"]);
export type MobileAudience = z.infer<typeof mobileAudienceSchema>;

/** Portée marque blanche : toute la brand ou un institut dédié. */
export const mobileScopeTypeSchema = z.enum(["brand", "tenant"]);
export type MobileScopeType = z.infer<typeof mobileScopeTypeSchema>;

/** Thème visuel injecté dans l'app native (cascade brand → tenant → app). */
export const mobileBrandingSchema = z.object({
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  splashImageUrl: z.string().url().nullable().optional(),
  fontFamily: z.string().optional(),
});
export type MobileBranding = z.infer<typeof mobileBrandingSchema>;

/** Payload renvoyé au démarrage de l'app (GET /api/mobile/bootstrap). */
export const mobileBootstrapSchema = z.object({
  appId: z.string().uuid(),
  audience: mobileAudienceSchema,
  scopeType: mobileScopeTypeSchema,
  appName: z.string(),
  appSlug: z.string(),
  deepLinkScheme: z.string().nullable(),
  branding: mobileBrandingSchema,
  brand: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  tenant: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
  api: z.object({
    baseUrl: z.string().url(),
    supabaseUrl: z.string().url(),
    supabaseAnonKey: z.string(),
  }),
  features: z.object({
    /** Modules activés pour le tenant courant (client) ou globalement (institut brand). */
    modules: z.array(z.string()),
  }),
});
export type MobileBootstrap = z.infer<typeof mobileBootstrapSchema>;

/** En-têtes attendus des clients natifs. */
export const MOBILE_HEADERS = {
  bundleId: "x-beautyhub-bundle-id",
  appVersion: "x-beautyhub-app-version",
  platform: "x-beautyhub-platform",
} as const;

export type MobilePlatform = "ios" | "android";
