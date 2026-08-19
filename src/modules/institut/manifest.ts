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
    {
      label: "Rendez-vous",
      href: "/institut/rendez-vous",
      icon: "calendar",
      permission: { key: "appointments" },
    },
    {
      label: "Prestations",
      href: "/institut/prestations",
      icon: "scissors",
      permission: { key: "services" },
    },
    {
      label: "Clients",
      href: "/institut/clients",
      icon: "contact",
      permission: { key: "clients" },
    },
    {
      label: "Equipe",
      href: "/institut/equipe",
      icon: "team",
      permission: { key: "team" },
    },
    {
      label: "Caisse",
      href: "/institut/caisse",
      icon: "cash",
      exact: true,
      permission: { key: "pos" },
    },
    {
      label: "Marketing",
      href: "/institut/marketing",
      icon: "chart",
      exact: true,
      permission: { key: "marketing" },
    },
  ],
  aiActions: [...institutAiActions, ...institutPosAiActions],
};
