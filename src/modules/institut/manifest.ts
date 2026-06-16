import { z } from "zod";
import { defineAction, type ModuleManifest } from "../types";

export const institutModule: ModuleManifest = {
  id: "institut",
  name: "Institut",
  description:
    "Prise de rendez-vous, prestations, caisse et fiches clients de l'institut.",
  category: "core",
  version: "1.0.0",
  nav: [
    { label: "Tableau de bord", href: "/institut", icon: "layout-dashboard" },
    { label: "Rendez-vous", href: "/institut/rendez-vous", icon: "calendar" },
    { label: "Prestations", href: "/institut/prestations", icon: "sparkles" },
    { label: "Clients", href: "/institut/clients", icon: "users" },
    {
      label: "Caisse",
      href: "/institut/caisse",
      icon: "shopping-cart",
      roles: ["platform_admin", "brand_owner", "tenant_owner", "staff"],
    },
  ],
  aiActions: [
    defineAction({
      name: "institut.create_client",
      description:
        "Cree une fiche client dans l'institut courant (cloisonnee par tenant).",
      parameters: z.object({
        email: z.string().email().describe("Email du client"),
        full_name: z.string().min(1).describe("Nom complet"),
        phone: z.string().optional().describe("Telephone"),
      }),
      requiredRole: "staff",
      quotaKey: "clients",
      handler: async (ctx, params) => {
        const { data, error } = await ctx.supabase
          .from("clients")
          .insert({
            tenant_id: ctx.tenantId,
            email: params.email,
            full_name: params.full_name,
            phone: params.phone ?? null,
          })
          .select("id, email, full_name")
          .single();
        if (error) throw new Error(error.message);
        return data;
      },
    }),
    defineAction({
      name: "institut.list_clients",
      description: "Liste les dernieres fiches clients de l'institut courant.",
      parameters: z.object({
        limit: z.number().int().min(1).max(100).default(20),
      }),
      requiredRole: "staff",
      handler: async (ctx, params) => {
        const { data, error } = await ctx.supabase
          .from("clients")
          .select("id, email, full_name, phone, created_at")
          .eq("tenant_id", ctx.tenantId)
          .order("created_at", { ascending: false })
          .limit(params.limit);
        if (error) throw new Error(error.message);
        return data;
      },
    }),
  ],
};
