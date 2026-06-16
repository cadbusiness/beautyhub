import { z } from "zod";
import { defineAction, type ModuleManifest } from "../types";

export const academieModule: ModuleManifest = {
  id: "academie",
  name: "Academie",
  description: "Formations en ligne, coachs, eleves et inscriptions.",
  category: "core",
  version: "1.0.0",
  nav: [
    { label: "Academie", href: "/academie", icon: "graduation-cap" },
    {
      label: "Formations",
      href: "/academie/formations",
      icon: "book-open",
      roles: ["platform_admin", "brand_owner", "tenant_owner", "coach"],
    },
    { label: "Eleves", href: "/academie/eleves", icon: "user-round" },
  ],
  aiActions: [
    defineAction({
      name: "academie.create_course",
      description:
        "Cree une formation (placeholder Phase 2 - le modele de donnees arrive avec le module Academie).",
      parameters: z.object({
        title: z.string().min(1).describe("Titre de la formation"),
      }),
      requiredRole: "tenant_owner",
      confirm: true,
      handler: async () => {
        throw new Error(
          "Module Academie: creation de formation a implementer en Phase 2.",
        );
      },
    }),
  ],
};
