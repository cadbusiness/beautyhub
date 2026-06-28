export type AdminNavItem = {
  href: string;
  labelKey:
    | "adminOverview"
    | "adminTenants"
    | "adminBrands"
    | "adminPlans"
    | "adminSubscriptions"
    | "adminModules"
    | "adminTeam"
    | "adminSupport"
    | "adminSettings";
  icon: string;
  exact?: boolean;
  badgeKey?: "openTickets";
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", labelKey: "adminOverview", icon: "home", exact: true },
  { href: "/admin/tenants", labelKey: "adminTenants", icon: "team" },
  { href: "/admin/brands", labelKey: "adminBrands", icon: "building" },
  { href: "/admin/plans", labelKey: "adminPlans", icon: "cash" },
  { href: "/admin/subscriptions", labelKey: "adminSubscriptions", icon: "chart" },
  { href: "/admin/modules", labelKey: "adminModules", icon: "book-open" },
  { href: "/admin/team", labelKey: "adminTeam", icon: "contact" },
  { href: "/admin/support", labelKey: "adminSupport", icon: "life-buoy", badgeKey: "openTickets" },
  { href: "/admin/settings", labelKey: "adminSettings", icon: "settings" },
];
