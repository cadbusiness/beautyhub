import { z } from "zod";
import { defineAction } from "../types";
import { checkAppointmentConflict } from "@/lib/institut/slots";
import {
  fetchTenantContext,
  resolveAppointmentExtras,
  resolveClient,
  resolveResource,
  resolveSchedule,
  resolveService,
  resolveStaff,
} from "./ai-helpers";
import {
  resolveBookingTotals,
  syncAppointmentExtras,
} from "@/lib/institut/appointment-extras";

const scheduleBlockSchema = z.object({
  weekday: z.number().int().min(0).max(6).describe("0=dimanche, 1=lundi … 6=samedi"),
  start_time: z.string().describe("Heure de début HH:MM"),
  end_time: z.string().describe("Heure de fin HH:MM"),
});

export const institutAiActions = [
  defineAction({
    name: "institut.create_client",
    description: "Crée une fiche client dans l'institut.",
    parameters: z.object({
      email: z.string().email().describe("Email du client"),
      full_name: z.string().min(1).describe("Nom complet"),
      phone: z.string().optional().describe("Téléphone"),
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
        .select("id, email, full_name, phone")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_clients",
    description: "Liste les fiches clients de l'institut.",
    parameters: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      query: z.string().optional().describe("Recherche par nom ou email"),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      let q = ctx.supabase
        .from("clients")
        .select("id, email, full_name, phone, created_at")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(params.limit);
      const query = params.query?.trim();
      if (query) {
        q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_services",
    description: "Liste les prestations actives de l'institut.",
    parameters: z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_services")
        .select("id, name, duration_min, price_cents, is_active, visibility")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .order("name")
        .limit(params.limit);
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_staff",
    description: "Liste le personnel actif de l'institut.",
    parameters: z.object({}),
    requiredRole: "staff",
    handler: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("inst_staff")
        .select("id, full_name, email, schedule_id, is_active")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_resources",
    description: "Liste les cabines et ressources actives.",
    parameters: z.object({}),
    requiredRole: "staff",
    handler: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("inst_resources")
        .select("id, name, schedule_id, is_active")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_service_extras",
    description:
      "Liste les extras (upsell) configurés pour une prestation — ce sont d'autres prestations liées.",
    parameters: z.object({
      service_id: z.string().uuid().optional(),
      service_name: z.string().optional(),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const service = await resolveService(ctx.supabase, ctx.tenantId, params);
      if (!service) throw new Error("Prestation introuvable.");

      const { data, error } = await ctx.supabase
        .from("inst_service_extras")
        .select(
          "min_qty, max_qty, extra:inst_services!inst_service_extras_extra_service_id_fkey(id, name, duration_min, price_cents, image_url, visibility)",
        )
        .eq("tenant_id", ctx.tenantId)
        .eq("service_id", service.id)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_appointments",
    description: "Liste les rendez-vous sur une période.",
    parameters: z.object({
      date_from: z.string().optional().describe("Date de début ISO (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("Date de fin ISO (YYYY-MM-DD)"),
      staff_name: z.string().optional().describe("Filtrer par praticien"),
      limit: z.number().int().min(1).max(100).default(30),
    }),
    requiredRole: "staff",
    handler: async (ctx, params) => {
      const from = params.date_from
        ? new Date(`${params.date_from}T00:00:00`)
        : new Date();
      from.setHours(0, 0, 0, 0);
      const to = params.date_to
        ? new Date(`${params.date_to}T23:59:59`)
        : new Date(from.getTime() + 7 * 86_400_000);

      let q = ctx.supabase
        .from("inst_appointments")
        .select(
          "id, starts_at, ends_at, status, price_cents, staff:inst_staff(full_name), client:clients(full_name), service:inst_services(name), extras:inst_appointment_extras(name, quantity, price_cents, duration_min)",
        )
        .eq("tenant_id", ctx.tenantId)
        .gte("starts_at", from.toISOString())
        .lte("starts_at", to.toISOString())
        .order("starts_at")
        .limit(params.limit);

      if (params.staff_name) {
        const staff = await resolveStaff(ctx.supabase, ctx.tenantId, {
          staff_name: params.staff_name,
        });
        if (!staff) throw new Error(`Praticien introuvable : ${params.staff_name}`);
        q = q.eq("staff_id", staff.id);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.create_appointment",
    description:
      "Crée un rendez-vous pour un client. Les extras sont d'autres prestations liées (upsell) — utiliser list_service_extras pour voir les options.",
    parameters: z.object({
      service_id: z.string().uuid().optional(),
      service_name: z.string().optional().describe("Nom de la prestation"),
      client_id: z.string().uuid().optional(),
      client_email: z.string().optional(),
      client_name: z.string().optional(),
      staff_id: z.string().uuid().optional(),
      staff_name: z.string().optional().describe("Nom du praticien"),
      resource_id: z.string().uuid().optional(),
      resource_name: z.string().optional(),
      starts_at: z.string().describe("Date/heure de début ISO 8601"),
      notes: z.string().optional(),
      extras: z
        .array(
          z.object({
            service_id: z.string().uuid().optional(),
            extra_name: z.string().optional().describe("Nom de l'extra si ID inconnu"),
            quantity: z.number().int().positive().default(1),
          }),
        )
        .optional()
        .describe("Prestations extras à ajouter au rendez-vous"),
    }),
    requiredRole: "staff",
    quotaKey: "appointments_per_month",
    confirm: true,
    handler: async (ctx, params) => {
      const service = await resolveService(ctx.supabase, ctx.tenantId, params);
      if (!service) throw new Error("Prestation introuvable.");

      const extras = await resolveAppointmentExtras(ctx.supabase, ctx.tenantId, service.id, params);
      const totals = await resolveBookingTotals(ctx.supabase, service.id, extras);
      if ("error" in totals) {
        throw new Error(
          totals.error === "service_not_found" ? "Prestation introuvable." : totals.error,
        );
      }

      const startsAt = new Date(params.starts_at);
      if (Number.isNaN(startsAt.getTime())) throw new Error("Date/heure invalide.");

      const { data: svcBuffers } = await ctx.supabase
        .from("inst_services")
        .select("buffer_before_min, buffer_after_min")
        .eq("id", service.id)
        .maybeSingle();

      const endsAt = new Date(startsAt.getTime() + totals.durationMin * 60_000);
      const staff = params.staff_id || params.staff_name
        ? await resolveStaff(ctx.supabase, ctx.tenantId, params)
        : null;
      const resource = params.resource_id || params.resource_name
        ? await resolveResource(ctx.supabase, ctx.tenantId, params)
        : null;
      const client = params.client_id || params.client_email || params.client_name
        ? await resolveClient(ctx.supabase, ctx.tenantId, params)
        : null;

      const conflict = await checkAppointmentConflict(ctx.supabase, ctx.tenantId, {
        staffId: staff?.id ?? null,
        resourceId: resource?.id ?? null,
        startsAt,
        endsAt,
        bufferBeforeMin: svcBuffers?.buffer_before_min ?? 0,
        bufferAfterMin: svcBuffers?.buffer_after_min ?? 0,
      });
      if (conflict) throw new Error(`Conflit : ${conflict}`);

      const { data, error } = await ctx.supabase
        .from("inst_appointments")
        .insert({
          tenant_id: ctx.tenantId,
          service_id: service.id,
          client_id: client?.id ?? null,
          staff_id: staff?.id ?? null,
          resource_id: resource?.id ?? null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          price_cents: totals.priceCents,
          notes: params.notes ?? null,
        })
        .select("id, starts_at, ends_at, status, price_cents")
        .single();
      if (error) throw new Error(error.message);

      const extraErr = await syncAppointmentExtras(
        ctx.supabase,
        ctx.tenantId,
        data.id,
        service.id,
        extras,
      );
      if (extraErr) throw new Error(extraErr);

      if (extras.length > 0) {
        const { data: savedExtras } = await ctx.supabase
          .from("inst_appointment_extras")
          .select("name, quantity, price_cents")
          .eq("appointment_id", data.id);
        return { ...data, extras: savedExtras ?? [] };
      }
      return data;
    },
  }),

  defineAction({
    name: "institut.cancel_appointment",
    description: "Annule un rendez-vous existant.",
    parameters: z.object({
      appointment_id: z.string().uuid().describe("ID du rendez-vous"),
    }),
    requiredRole: "staff",
    confirm: true,
    handler: async (ctx, params) => {
      const { data, error } = await ctx.supabase
        .from("inst_appointments")
        .update({ status: "cancelled" })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", params.appointment_id)
        .select("id, starts_at, status")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_schedules",
    description: "Liste les grilles horaires de l'institut.",
    parameters: z.object({}),
    requiredRole: "tenant_owner",
    handler: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("inst_schedules")
        .select("id, name, is_default, blocks:inst_schedule_blocks(weekday, start_time, end_time)")
        .eq("tenant_id", ctx.tenantId)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.create_schedule",
    description: "Crée une nouvelle grille horaire nommée.",
    parameters: z.object({
      name: z.string().min(1).describe("Nom de la grille, ex. Horaires été"),
      is_default: z.boolean().default(false),
    }),
    requiredRole: "tenant_owner",
    handler: async (ctx, params) => {
      if (params.is_default) {
        await ctx.supabase
          .from("inst_schedules")
          .update({ is_default: false })
          .eq("tenant_id", ctx.tenantId)
          .eq("is_default", true);
      }
      const { data, error } = await ctx.supabase
        .from("inst_schedules")
        .insert({
          tenant_id: ctx.tenantId,
          name: params.name,
          is_default: params.is_default,
        })
        .select("id, name, is_default")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.update_schedule_blocks",
    description:
      "Met à jour les plages horaires d'une grille (plusieurs plages par jour pour les pauses).",
    parameters: z.object({
      schedule_id: z.string().uuid().optional(),
      schedule_name: z.string().optional(),
      blocks: z
        .array(scheduleBlockSchema)
        .describe("Liste des plages horaires par jour"),
    }),
    requiredRole: "tenant_owner",
    confirm: true,
    handler: async (ctx, params) => {
      const schedule = await resolveSchedule(ctx.supabase, ctx.tenantId, params);
      if (!schedule) throw new Error("Grille horaire introuvable.");

      for (const block of params.blocks) {
        if (block.start_time >= block.end_time) {
          throw new Error(`Plage invalide : ${block.start_time}–${block.end_time}`);
        }
      }

      await ctx.supabase
        .from("inst_schedule_blocks")
        .delete()
        .eq("schedule_id", schedule.id);

      if (params.blocks.length > 0) {
        const { error } = await ctx.supabase.from("inst_schedule_blocks").insert(
          params.blocks.map((b) => ({
            schedule_id: schedule.id,
            weekday: b.weekday,
            start_time: b.start_time.slice(0, 5),
            end_time: b.end_time.slice(0, 5),
          })),
        );
        if (error) throw new Error(error.message);
      }

      return { schedule_id: schedule.id, name: schedule.name, blocks: params.blocks.length };
    },
  }),

  defineAction({
    name: "institut.assign_staff_schedule",
    description: "Assigne une grille horaire à un membre du personnel.",
    parameters: z.object({
      staff_id: z.string().uuid().optional(),
      staff_name: z.string().optional().describe("Nom du praticien, ex. Léa Dubois"),
      schedule_id: z.string().uuid().optional(),
      schedule_name: z.string().optional().describe("Nom de la grille horaire"),
    }),
    requiredRole: "tenant_owner",
    handler: async (ctx, params) => {
      const staff = await resolveStaff(ctx.supabase, ctx.tenantId, params);
      if (!staff) throw new Error("Praticien introuvable.");

      let scheduleId: string | null = null;
      if (params.schedule_id || params.schedule_name) {
        const schedule = await resolveSchedule(ctx.supabase, ctx.tenantId, params);
        if (!schedule) throw new Error("Grille horaire introuvable.");
        scheduleId = schedule.id;
      }

      const { error } = await ctx.supabase
        .from("inst_staff")
        .update({ schedule_id: scheduleId })
        .eq("id", staff.id);
      if (error) throw new Error(error.message);

      return {
        staff: staff.full_name,
        schedule_id: scheduleId,
        schedule_name: scheduleId ? params.schedule_name ?? params.schedule_id : "grille par défaut",
      };
    },
  }),

  defineAction({
    name: "institut.assign_resource_schedule",
    description: "Assigne une grille horaire à une cabine.",
    parameters: z.object({
      resource_id: z.string().uuid().optional(),
      resource_name: z.string().optional(),
      schedule_id: z.string().uuid().optional(),
      schedule_name: z.string().optional(),
    }),
    requiredRole: "tenant_owner",
    handler: async (ctx, params) => {
      const resource = await resolveResource(ctx.supabase, ctx.tenantId, params);
      if (!resource) throw new Error("Cabine introuvable.");

      let scheduleId: string | null = null;
      if (params.schedule_id || params.schedule_name) {
        const schedule = await resolveSchedule(ctx.supabase, ctx.tenantId, params);
        if (!schedule) throw new Error("Grille horaire introuvable.");
        scheduleId = schedule.id;
      }

      const { error } = await ctx.supabase
        .from("inst_resources")
        .update({ schedule_id: scheduleId })
        .eq("id", resource.id);
      if (error) throw new Error(error.message);

      return { resource: resource.name, schedule_id: scheduleId };
    },
  }),

  defineAction({
    name: "institut.create_time_off",
    description:
      "Planifie une absence : fermeture institut, congés praticien ou indisponibilité cabine.",
    parameters: z.object({
      scope: z
        .enum(["tenant", "staff", "resource"])
        .describe("tenant=fermeture institut, staff=congé praticien, resource=cabine"),
      staff_id: z.string().uuid().optional(),
      staff_name: z.string().optional().describe("Nom du praticien si scope=staff"),
      resource_id: z.string().uuid().optional(),
      resource_name: z.string().optional(),
      starts_at: z.string().describe("Début ISO 8601"),
      ends_at: z.string().describe("Fin ISO 8601"),
      reason: z.string().optional().describe("Motif : vacances, formation…"),
    }),
    requiredRole: "tenant_owner",
    confirm: true,
    handler: async (ctx, params) => {
      const startsAt = new Date(params.starts_at);
      const endsAt = new Date(params.ends_at);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new Error("Dates invalides.");
      }
      if (startsAt >= endsAt) throw new Error("La fin doit être après le début.");

      let staffId: string | null = null;
      let resourceId: string | null = null;

      if (params.scope === "staff") {
        const staff = await resolveStaff(ctx.supabase, ctx.tenantId, params);
        if (!staff) throw new Error("Praticien introuvable.");
        staffId = staff.id;
      } else if (params.scope === "resource") {
        const resource = await resolveResource(ctx.supabase, ctx.tenantId, params);
        if (!resource) throw new Error("Cabine introuvable.");
        resourceId = resource.id;
      }

      const { data, error } = await ctx.supabase
        .from("inst_time_off")
        .insert({
          tenant_id: ctx.tenantId,
          staff_id: staffId,
          resource_id: resourceId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          reason: params.reason ?? null,
        })
        .select("id, starts_at, ends_at, reason, staff_id, resource_id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.list_time_off",
    description: "Liste les absences et fermetures planifiées.",
    parameters: z.object({
      upcoming_only: z.boolean().default(true),
      limit: z.number().int().min(1).max(100).default(30),
    }),
    requiredRole: "tenant_owner",
    handler: async (ctx, params) => {
      let q = ctx.supabase
        .from("inst_time_off")
        .select(
          "id, starts_at, ends_at, reason, staff:inst_staff(full_name), resource:inst_resources(name)",
        )
        .eq("tenant_id", ctx.tenantId)
        .order("starts_at")
        .limit(params.limit);

      if (params.upcoming_only) {
        q = q.gte("ends_at", new Date().toISOString());
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  }),

  defineAction({
    name: "institut.delete_time_off",
    description: "Supprime une absence planifiée.",
    parameters: z.object({
      time_off_id: z.string().uuid().describe("ID de l'absence"),
    }),
    requiredRole: "tenant_owner",
    confirm: true,
    handler: async (ctx, params) => {
      const { error } = await ctx.supabase
        .from("inst_time_off")
        .delete()
        .eq("tenant_id", ctx.tenantId)
        .eq("id", params.time_off_id);
      if (error) throw new Error(error.message);
      return { deleted: params.time_off_id };
    },
  }),
];
