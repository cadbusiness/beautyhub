const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Super admin",
  brand_owner: "Propriétaire marque",
  tenant_owner: "Propriétaire",
  staff: "Staff",
  coach: "Coach",
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}
