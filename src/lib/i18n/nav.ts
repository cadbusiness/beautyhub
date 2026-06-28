/** Mappe un href de navigation vers une clé `nav.*` dans les messages i18n. */
const NAV_MESSAGE_KEYS = {
  "/institut/rendez-vous": "institutAppointments",
  "/institut/prestations": "institutServices",
  "/institut/clients": "institutClients",
  "/institut/equipe": "institutTeam",
  "/institut/caisse": "institutPos",
  "/institut/caisse/session": "institutPosSession",
  "/institut/caisse/bons": "institutPosVouchers",
  "/institut/caisse/historique": "institutPosHistory",
  "/institut/caisse/produits": "institutPosProducts",
  "/institut/marketing": "institutMarketing",
  "/institut/marketing/fidelite": "institutMarketingLoyalty",
  "/institut/marketing/page-web": "institutMarketingWebsite",
  "/institut/marketing/promos": "institutMarketingPromos",
  "/institut/parametres": "institutSettings",
  "/academie": "academieOverview",
  "/academie/formations": "academieCourses",
  "/academie/eleves": "academieStudents",
  "/admin": "adminOverview",
  "/admin/tenants": "adminTenants",
  "/admin/brands": "adminBrands",
  "/admin/plans": "adminPlans",
  "/admin/subscriptions": "adminSubscriptions",
  "/admin/modules": "adminModules",
  "/admin/team": "adminTeam",
  "/admin/support": "adminSupport",
  "/admin/settings": "adminSettings",
} as const;

export type NavMessageKey = (typeof NAV_MESSAGE_KEYS)[keyof typeof NAV_MESSAGE_KEYS];

export function navMessageKey(href: string): NavMessageKey | null {
  const path = href.split("?")[0] as keyof typeof NAV_MESSAGE_KEYS;
  return NAV_MESSAGE_KEYS[path] ?? null;
}

export function weekdayMessageKey(weekday: number): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const map: Record<number, "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  };
  return map[weekday] ?? "mon";
}
