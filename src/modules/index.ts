import { registerModule } from "./registry";
import { institutModule } from "./institut/manifest";
import { academieModule } from "./academie/manifest";

/**
 * Enregistrement des modules first-party de cette build.
 * Importer ce fichier garantit que le registre est peuple une seule fois.
 */
let initialized = false;

export function initModules(): void {
  if (initialized) return;
  registerModule(institutModule);
  registerModule(academieModule);
  initialized = true;
}

initModules();

export * from "./registry";
export * from "./types";
