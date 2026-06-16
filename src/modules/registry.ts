import type { AIAction, ModuleId, ModuleManifest, TeamRole } from "./types";

const ROLE_RANK: Record<TeamRole, number> = {
  staff: 1,
  coach: 1,
  tenant_owner: 2,
  brand_owner: 3,
  platform_admin: 4,
};

/** Registre global des modules disponibles dans cette build. */
const registry = new Map<ModuleId, ModuleManifest>();

export function registerModule(manifest: ModuleManifest): void {
  if (registry.has(manifest.id)) {
    throw new Error(`Module deja enregistre: ${manifest.id}`);
  }
  registry.set(manifest.id, manifest);
}

export function getModule(id: ModuleId): ModuleManifest | undefined {
  return registry.get(id);
}

export function getAllModules(): ModuleManifest[] {
  return [...registry.values()];
}

export function roleSatisfies(role: TeamRole, required?: TeamRole): boolean {
  if (!required) return true;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/**
 * Construit le registre d'actions IA pour un ensemble de modules actives + un role.
 * C'est ce que consomme l'assistant IA: ajouter un module l'expose automatiquement.
 */
export function getAiActionsFor(
  enabledModuleIds: ModuleId[],
  role: TeamRole,
): AIAction[] {
  const enabled = new Set(enabledModuleIds);
  const actions: AIAction[] = [];
  for (const mod of registry.values()) {
    if (!enabled.has(mod.id)) continue;
    for (const action of mod.aiActions ?? []) {
      if (roleSatisfies(role, action.requiredRole)) {
        actions.push(action);
      }
    }
  }
  return actions;
}

/** Entrees de navigation pour les modules actives, filtrees par role. */
export function getNavFor(enabledModuleIds: ModuleId[], role: TeamRole) {
  const enabled = new Set(enabledModuleIds);
  return getAllModules()
    .filter((m) => enabled.has(m.id))
    .flatMap((m) =>
      (m.nav ?? [])
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({ ...item, moduleId: m.id })),
    );
}
