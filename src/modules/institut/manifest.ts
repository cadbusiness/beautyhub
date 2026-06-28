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
    { label: "Prestations", href: "/institut/prestations", icon: "scissors" },
    { label: "Clients", href: "/institut/clients", icon: "contact" },
    {
      label: "Equipe",
      href: "/institut/equipe",
      icon: "team",
      roles: ["platform_admin", "brand_owner", "tenant_owner"],
    },
    {
      label: "Caisse",
      href: "/institut/caisse",
      icon: "cash",
      exact: true,
      roles: ["platform_admin", "brand_owner", "tenant_owner", "staff"],
    },
    {
      label: "Marketing",
      href: "/institut/marketing",
      icon: "chart",
      exact: true,
      roles: ["platform_admin", "brand_owner", "tenant_owner"],
    },
  ],
  aiActions: [...institutAiActions, ...institutPosAiActions],
};
