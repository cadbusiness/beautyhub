import { z } from "zod";
import { defineAction, type ModuleManifest } from "../types";

export const academieModule: ModuleManifest = {
  id: "academie",
  name: "Academie",
  description: "Formations en ligne, coachs, eleves et inscriptions.",
  category: "core",
  version: "1.0.0",
  nav: [{ label: "Academie", href: "/academie", icon: "book-open" }],
  aiActions: [
    defineAction({
      name: "academie.list_courses",
      description: "Liste les formations de l'academie courante.",
      parameters: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        publishedOnly: z.boolean().default(false),
      }),
      requiredRole: "coach",
      handler: async (ctx, params) => {
        let query = ctx.supabase
          .from("acad_courses")
          .select("id, title, description, price_cents, currency, is_published, created_at")
          .eq("tenant_id", ctx.tenantId)
          .order("created_at", { ascending: false })
          .limit(params.limit);
        if (params.publishedOnly) {
          query = query.eq("is_published", true);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data;
      },
    }),
    defineAction({
      name: "academie.create_course",
      description: "Cree une formation dans l'academie courante.",
      parameters: z.object({
        title: z.string().min(1).describe("Titre de la formation"),
        description: z.string().optional().describe("Description"),
        price_cents: z.number().int().min(0).default(0).describe("Prix en centimes"),
        is_published: z.boolean().default(false).describe("Publier immediatement"),
      }),
      requiredRole: "tenant_owner",
      confirm: true,
      handler: async (ctx, params) => {
        const { data, error } = await ctx.supabase
          .from("acad_courses")
          .insert({
            tenant_id: ctx.tenantId,
            title: params.title,
            description: params.description ?? null,
            price_cents: params.price_cents,
            is_published: params.is_published,
          })
          .select("id, title, price_cents, is_published")
          .single();
        if (error) throw new Error(error.message);
        return data;
      },
    }),
  ],
};