import { institutAiActions } from "./ai-actions";
import { institutPosAiActions } from "./ai-pos-actions";
import type { ModuleManifest } from "../types";

export const institutModule: ModuleManifest = {
  id: "institut",
  name: "Institut",
  description:
    "Prise de rendez-vous, prestations, caisse et fiches clients de l'institut.",
  category: "core",
  version: "1.0.0",
  nav: [
    { label: "Rendez-vous", href: "/institut/rendez-vous", icon: "calendar" },
    { label: "Prestations", href: "/institut/prestations", icon: "sparkles" },
    { label: "Clients", href: "/institut/clients", icon: "users" },
    {
      label: "Equipe",
      href: "/institut/equipe",
      icon: "user-cog",
      roles: ["platform_admin", "brand_owner", "tenant_owner"],
    },
    {
      label: "Caisse",
      href: "/institut/caisse",
      icon: "shopping-cart",
      exact: true,
      roles: ["platform_admin", "brand_owner", "tenant_owner", "staff"],
    },
  ],
  aiActions: [...institutAiActions, ...institutPosAiActions],
};
