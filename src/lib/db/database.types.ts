export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acad_courses: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          is_published: boolean
          price_cents: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          price_cents?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          price_cents?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acad_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      acad_enrollments: {
        Row: {
          client_id: string | null
          course_id: string
          created_at: string
          id: string
          status: string
          student_email: string
          student_name: string
          tenant_id: string
        }
        Insert: {
          client_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          status?: string
          student_email: string
          student_name: string
          tenant_id: string
        }
        Update: {
          client_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          status?: string
          student_email?: string
          student_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acad_enrollments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acad_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "acad_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acad_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          branding: Json
          created_at: string
          id: string
          is_platform: boolean
          name: string
          owner_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          id?: string
          is_platform?: boolean
          name: string
          owner_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          id?: string
          is_platform?: boolean
          name?: string
          owner_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string | null
          id: string
          login_id: string | null
          marketing_opt_in: boolean
          metadata: Json
          notes: string | null
          password_hash: string | null
          phone: string | null
          pin_code: string | null
          pin_hash: string | null
          postal_code: string | null
          referred_by_client_id: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          id?: string
          login_id?: string | null
          marketing_opt_in?: boolean
          metadata?: Json
          notes?: string | null
          password_hash?: string | null
          phone?: string | null
          pin_code?: string | null
          pin_hash?: string | null
          postal_code?: string | null
          referred_by_client_id?: string | null
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          id?: string
          login_id?: string | null
          marketing_opt_in?: boolean
          metadata?: Json
          notes?: string | null
          password_hash?: string | null
          phone?: string | null
          pin_code?: string | null
          pin_hash?: string | null
          postal_code?: string | null
          referred_by_client_id?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          resource_id: string | null
          resource_type: string
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          client_id: string
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          ip_address: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          client_id: string
          consent_type: string
          created_at?: string
          granted: boolean
          id?: string
          ip_address?: string | null
          source: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          client_id?: string
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          config: Json
          created_at: string
          credentials: Json
          id: string
          provider: string
          scope_id: string | null
          scope_type: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials?: Json
          id?: string
          provider: string
          scope_id?: string | null
          scope_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials?: Json
          id?: string
          provider?: string
          scope_id?: string | null
          scope_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inst_appointment_extras: {
        Row: {
          appointment_id: string
          created_at: string
          duration_min: number
          id: string
          name: string
          price_cents: number
          quantity: number
          service_id: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_min: number
          id?: string
          name: string
          price_cents: number
          quantity?: number
          service_id: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          quantity?: number
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_appointment_extras_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "inst_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointment_extras_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointment_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_appointments: {
        Row: {
          client_id: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          price_cents: number | null
          resource_id: string | null
          service_id: string | null
          staff_id: string | null
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          price_cents?: number | null
          resource_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_cents?: number | null
          resource_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "inst_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "inst_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_cash_movements: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          movement_type: string
          reason: string
          session_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          movement_type: string
          reason: string
          session_id: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          movement_type?: string
          reason?: string
          session_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      inst_cash_reports: {
        Row: {
          created_at: string
          id: string
          report_number: string
          report_type: string
          session_id: string
          snapshot: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_number: string
          report_type: string
          session_id: string
          snapshot?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_number?: string
          report_type?: string
          session_id?: string
          snapshot?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      inst_cash_sessions: {
        Row: {
          closed_at: string | null
          closing_counted_cents: number | null
          closing_expected_cents: number | null
          closing_variance_cents: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opening_float_cents: number
          status: string
          tenant_id: string
          updated_at: string
          z_report_number: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_counted_cents?: number | null
          closing_expected_cents?: number | null
          closing_variance_cents?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_cents?: number
          status?: string
          tenant_id: string
          updated_at?: string
          z_report_number?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_counted_cents?: number | null
          closing_expected_cents?: number | null
          closing_variance_cents?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_cents?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          z_report_number?: string | null
        }
        Relationships: []
      }
      inst_credit_notes: {
        Row: {
          amount_cents: number
          client_id: string | null
          created_at: string
          credit_number: string
          expires_at: string | null
          id: string
          reason: string | null
          remaining_cents: number
          sale_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_id?: string | null
          created_at?: string
          credit_number: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          remaining_cents: number
          sale_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_id?: string | null
          created_at?: string
          credit_number?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          remaining_cents?: number
          sale_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      inst_gift_cards: {
        Row: {
          balance_cents: number
          client_id: string | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          initial_balance_cents: number
          recipient_name: string | null
          sale_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_cents: number
          client_id?: string | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_balance_cents: number
          recipient_name?: string | null
          sale_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          client_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          initial_balance_cents?: number
          recipient_name?: string | null
          sale_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      inst_commercial_document_lines: {
        Row: {
          description: string | null
          document_id: string
          id: string
          label: string
          quantity: number
          service_id: string | null
          sort_order: number
          tenant_id: string
          unit_price_cents: number
        }
        Insert: {
          description?: string | null
          document_id: string
          id?: string
          label: string
          quantity?: number
          service_id?: string | null
          sort_order?: number
          tenant_id: string
          unit_price_cents?: number
        }
        Update: {
          description?: string | null
          document_id?: string
          id?: string
          label?: string
          quantity?: number
          service_id?: string | null
          sort_order?: number
          tenant_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_commercial_document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "inst_commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_document_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_document_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_commercial_documents: {
        Row: {
          accepted_at: string | null
          appointment_id: string | null
          client_id: string | null
          client_message: string | null
          created_at: string
          currency: string
          declined_at: string | null
          discount_cents: number
          doc_number: string | null
          doc_type: string
          event_date: string | null
          id: string
          internal_notes: string | null
          public_token: string
          sent_at: string | null
          service_id: string | null
          source_document_id: string | null
          status: string
          subtotal_cents: number
          template_id: string
          tenant_id: string
          total_cents: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          appointment_id?: string | null
          client_id?: string | null
          client_message?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          discount_cents?: number
          doc_number?: string | null
          doc_type: string
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          public_token?: string
          sent_at?: string | null
          service_id?: string | null
          source_document_id?: string | null
          status?: string
          subtotal_cents?: number
          template_id?: string
          tenant_id: string
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          appointment_id?: string | null
          client_id?: string | null
          client_message?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          discount_cents?: number
          doc_number?: string | null
          doc_type?: string
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          public_token?: string
          sent_at?: string | null
          service_id?: string | null
          source_document_id?: string | null
          status?: string
          subtotal_cents?: number
          template_id?: string
          tenant_id?: string
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inst_commercial_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "inst_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_documents_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "inst_commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_commercial_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_document_sequences: {
        Row: {
          doc_type: string
          last_number: number
          tenant_id: string
        }
        Insert: {
          doc_type: string
          last_number?: number
          tenant_id: string
        }
        Update: {
          doc_type?: string
          last_number?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_document_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_pos_settings: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          default_vat_rate_bps: number
          fiscal_regime: string
          legal_address: string | null
          legal_name: string | null
          payment_methods: Json
          price_display: string
          product_vat_rate_bps: number
          service_vat_rate_bps: number
          siret: string | null
          tenant_id: string
          ticket_footer: string | null
          ticket_header: string | null
          ticket_prefix: string
          updated_at: string
          vat_number: string | null
          require_open_session: boolean
          default_opening_float_cents: number
          credit_note_prefix: string
          gift_card_prefix: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency?: string
          default_vat_rate_bps?: number
          fiscal_regime?: string
          legal_address?: string | null
          legal_name?: string | null
          payment_methods?: Json
          price_display?: string
          product_vat_rate_bps?: number
          service_vat_rate_bps?: number
          siret?: string | null
          tenant_id: string
          ticket_footer?: string | null
          ticket_header?: string | null
          ticket_prefix?: string
          updated_at?: string
          vat_number?: string | null
          require_open_session?: boolean
          default_opening_float_cents?: number
          credit_note_prefix?: string
          gift_card_prefix?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          default_vat_rate_bps?: number
          fiscal_regime?: string
          legal_address?: string | null
          legal_name?: string | null
          payment_methods?: Json
          price_display?: string
          product_vat_rate_bps?: number
          service_vat_rate_bps?: number
          siret?: string | null
          tenant_id?: string
          ticket_footer?: string | null
          ticket_header?: string | null
          ticket_prefix?: string
          updated_at?: string
          vat_number?: string | null
          require_open_session?: boolean
          default_opening_float_cents?: number
          credit_note_prefix?: string
          gift_card_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_pos_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_products: {
        Row: {
          created_at: string
          currency: string
          id: string
          image_url: string | null
          name: string
          price_cents: number
          sku: string | null
          source: string
          status: string
          stock_quantity: number | null
          synced_at: string | null
          tenant_id: string
          updated_at: string
          woo_id: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          name: string
          price_cents?: number
          sku?: string | null
          source?: string
          status?: string
          stock_quantity?: number | null
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
          woo_id?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          sku?: string | null
          source?: string
          status?: string
          stock_quantity?: number | null
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
          woo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inst_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_resources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          schedule_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          schedule_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          schedule_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_resources_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "inst_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_schedule_blocks: {
        Row: {
          created_at: string
          end_time: string
          id: string
          schedule_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          schedule_id: string
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          schedule_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_schedule_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "inst_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_schedules: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_sale_items: {
        Row: {
          appointment_id: string | null
          discount_cents: number
          id: string
          item_type: string
          line_subtotal_cents: number
          line_total_cents: number
          line_vat_cents: number
          name: string
          product_id: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          tenant_id: string
          unit_price_cents: number
          vat_rate_bps: number
        }
        Insert: {
          appointment_id?: string | null
          discount_cents?: number
          id?: string
          item_type?: string
          line_subtotal_cents?: number
          line_total_cents?: number
          line_vat_cents?: number
          name: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          service_id?: string | null
          tenant_id: string
          unit_price_cents?: number
          vat_rate_bps?: number
        }
        Update: {
          appointment_id?: string | null
          discount_cents?: number
          id?: string
          item_type?: string
          line_subtotal_cents?: number
          line_total_cents?: number
          line_vat_cents?: number
          name?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          tenant_id?: string
          unit_price_cents?: number
          vat_rate_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inst_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "inst_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_sale_payments: {
        Row: {
          amount_cents: number
          created_at: string
          credit_note_id: string | null
          gift_card_id: string | null
          id: string
          method: string
          reference: string | null
          sale_id: string
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_note_id?: string | null
          gift_card_id?: string | null
          id?: string
          method: string
          reference?: string | null
          sale_id: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_note_id?: string | null
          gift_card_id?: string | null
          id?: string
          method?: string
          reference?: string | null
          sale_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "inst_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_sale_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_sales: {
        Row: {
          amount_paid_cents: number
          appointment_id: string | null
          cash_session_id: string | null
          client_id: string | null
          created_at: string
          currency: string
          discount_cents: number
          id: string
          notes: string | null
          parent_sale_id: string | null
          payment_method: string
          sale_kind: string
          staff_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tenant_id: string
          ticket_number: string | null
          total_cents: number
          updated_at: string
          vat_cents: number
          woo_order_id: number | null
        }
        Insert: {
          amount_paid_cents?: number
          appointment_id?: string | null
          cash_session_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          parent_sale_id?: string | null
          payment_method?: string
          sale_kind?: string
          staff_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tenant_id: string
          ticket_number?: string | null
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          woo_order_id?: number | null
        }
        Update: {
          amount_paid_cents?: number
          appointment_id?: string | null
          cash_session_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          parent_sale_id?: string | null
          payment_method?: string
          sale_kind?: string
          staff_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tenant_id?: string
          ticket_number?: string | null
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          woo_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inst_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_service_extras: {
        Row: {
          extra_service_id: string
          max_qty: number
          min_qty: number
          service_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          extra_service_id: string
          max_qty?: number
          min_qty?: number
          service_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          extra_service_id?: string
          max_qty?: number
          min_qty?: number
          service_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_service_extras_extra_service_id_fkey"
            columns: ["extra_service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_service_extras_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_service_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_balances: {
        Row: {
          client_id: string
          last_birthday_bonus_year: number | null
          lifetime_earned: number
          lifetime_redeemed: number
          points_balance: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          last_birthday_bonus_year?: number | null
          lifetime_earned?: number
          lifetime_redeemed?: number
          points_balance?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          last_birthday_bonus_year?: number | null
          lifetime_earned?: number
          lifetime_redeemed?: number
          points_balance?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_earn_rules: {
        Row: {
          calc_mode: string
          created_at: string
          id: string
          is_active: boolean
          min_amount_cents: number
          name: string
          points_value: number
          program_id: string
          sort_order: number
          source_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          calc_mode: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_amount_cents?: number
          name: string
          points_value: number
          program_id: string
          sort_order?: number
          source_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          calc_mode?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_amount_cents?: number
          name?: string
          points_value?: number
          program_id?: string
          sort_order?: number
          source_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_earn_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_earn_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_programs: {
        Row: {
          birthday_auto_enabled: boolean
          birthday_bonus_points: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          points_label: string
          portal_visible: boolean
          referral_points: number
          same_day_rebook_points: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birthday_auto_enabled?: boolean
          birthday_bonus_points?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          points_label?: string
          portal_visible?: boolean
          referral_points?: number
          same_day_rebook_points?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birthday_auto_enabled?: boolean
          birthday_bonus_points?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          points_label?: string
          portal_visible?: boolean
          referral_points?: number
          same_day_rebook_points?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_rewards: {
        Row: {
          created_at: string
          description: string | null
          discount_cents: number | null
          discount_percent: number | null
          id: string
          is_active: boolean
          name: string
          new_service_only: boolean
          points_cost: number
          program_id: string
          reward_type: string
          service_id: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_cents?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          name: string
          new_service_only?: boolean
          points_cost: number
          program_id: string
          reward_type: string
          service_id?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_cents?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          name?: string
          new_service_only?: boolean
          points_cost?: number
          program_id?: string
          reward_type?: string
          service_id?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_rewards_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "inst_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_rewards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_redemptions: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          discount_cents: number | null
          id: string
          points_spent: number
          program_id: string
          reward_id: string
          sale_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          discount_cents?: number | null
          id?: string
          points_spent: number
          program_id: string
          reward_id: string
          sale_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          discount_cents?: number | null
          id?: string
          points_spent?: number
          program_id?: string
          reward_id?: string
          sale_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "inst_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_redemptions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_redemptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "inst_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_loyalty_transactions: {
        Row: {
          balance_after: number
          client_id: string
          created_at: string
          id: string
          idempotency_key: string
          notes: string | null
          points_delta: number
          program_id: string | null
          reward_id: string | null
          rule_id: string | null
          source_id: string | null
          source_type: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          balance_after: number
          client_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          notes?: string | null
          points_delta: number
          program_id?: string | null
          reward_id?: string | null
          rule_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          balance_after?: number
          client_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          points_delta?: number
          program_id?: string | null
          reward_id?: string | null
          rule_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_loyalty_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_transactions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_transactions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "inst_loyalty_earn_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_loyalty_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_site_pages: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_home: boolean
          is_published: boolean
          page_type: string
          page_style: Json
          seo_description: string | null
          seo_title: string | null
          show_in_nav: boolean
          slug: string
          sort_order: number
          template_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_home?: boolean
          is_published?: boolean
          page_type: string
          page_style?: Json
          seo_description?: string | null
          seo_title?: string | null
          show_in_nav?: boolean
          slug?: string
          sort_order?: number
          template_id?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_home?: boolean
          is_published?: boolean
          page_type?: string
          page_style?: Json
          seo_description?: string | null
          seo_title?: string | null
          show_in_nav?: boolean
          slug?: string
          sort_order?: number
          template_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_site_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_booking_flows: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          is_published: boolean
          name: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          is_published?: boolean
          name: string
          slug?: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          is_published?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_booking_flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_site_settings: {
        Row: {
          created_at: string
          display_name: string | null
          footer_text: string | null
          logo_url: string | null
          primary_color: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_services: {
        Row: {
          booking_mode: string
          buffer_after_min: number
          buffer_before_min: number
          color: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number
          extras_step_position: string
          id: string
          image_url: string | null
          is_active: boolean
          max_advance_days: number
          min_advance_hours: number
          name: string
          price_cents: number
          tenant_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          booking_mode?: string
          buffer_after_min?: number
          buffer_before_min?: number
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          extras_step_position?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name: string
          price_cents?: number
          tenant_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          booking_mode?: string
          buffer_after_min?: number
          buffer_before_min?: number
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          extras_step_position?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name?: string
          price_cents?: number
          tenant_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_staff: {
        Row: {
          color: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          schedule_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          schedule_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          schedule_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inst_staff_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "inst_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          resource_id: string | null
          staff_id: string | null
          starts_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          staff_id?: string | null
          starts_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          staff_id?: string | null
          starts_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_time_off_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "inst_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "inst_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_time_off_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_working_hours: {
        Row: {
          created_at: string
          end_time: string
          id: string
          staff_id: string | null
          start_time: string
          tenant_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          staff_id?: string | null
          start_time: string
          tenant_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          staff_id?: string | null
          start_time?: string
          tenant_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "inst_working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "inst_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inst_working_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          membership_role: string
          staff_id: string | null
          status: string
          tenant_id: string
          tenant_role_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          membership_role?: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          tenant_role_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          membership_role?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          tenant_role_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "inst_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_tenant_role_id_fkey"
            columns: ["tenant_role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: Json
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          role: string
          tenant_id: string | null
          tenant_role_id: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          role: string
          tenant_id?: string | null
          tenant_role_id?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string | null
          tenant_role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_apps: {
        Row: {
          app_name: string
          app_slug: string
          audience: string
          branding: Json
          bundle_id_android: string | null
          bundle_id_ios: string | null
          created_at: string
          deep_link_scheme: string | null
          id: string
          is_active: boolean
          scope_id: string
          scope_type: string
          updated_at: string
        }
        Insert: {
          app_name: string
          app_slug: string
          audience: string
          branding?: Json
          bundle_id_android?: string | null
          bundle_id_ios?: string | null
          created_at?: string
          deep_link_scheme?: string | null
          id?: string
          is_active?: boolean
          scope_id: string
          scope_type: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          app_slug?: string
          audience?: string
          branding?: Json
          bundle_id_android?: string | null
          bundle_id_ios?: string | null
          created_at?: string
          deep_link_scheme?: string | null
          id?: string
          is_active?: boolean
          scope_id?: string
          scope_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          version: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          version?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          version?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          brand_id: string | null
          created_at: string
          currency: string
          features: Json
          id: string
          interval: string
          is_active: boolean
          limits: Json
          modules: string[]
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          limits?: Json
          modules?: string[]
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          limits?: Json
          modules?: string[]
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          ai_enabled: boolean
          ai_model: string
          created_at: string
          id: string
          openai_api_key_enc: string | null
          support_notify_email: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_model?: string
          created_at?: string
          id?: string
          openai_api_key_enc?: string | null
          support_notify_email?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_model?: string
          created_at?: string
          id?: string
          openai_api_key_enc?: string | null
          support_notify_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          ai_summary: string | null
          body: string
          category: string
          conversation_excerpt: string | null
          created_at: string
          id: string
          page_url: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          ai_summary?: string | null
          body: string
          category: string
          conversation_excerpt?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          ai_summary?: string | null
          body?: string
          category?: string
          conversation_excerpt?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          phone: string | null
          preferred_locale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          phone?: string | null
          preferred_locale?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_modules: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_id: string
          branding: Json
          compliance: Json
          created_at: string
          custom_domain: string | null
          data_retention_days: number | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          branding?: Json
          compliance?: Json
          created_at?: string
          custom_domain?: string | null
          data_retention_days?: number | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          branding?: Json
          compliance?: Json
          created_at?: string
          custom_domain?: string | null
          data_retention_days?: number | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_has_brand_access: { Args: { bid: string }; Returns: boolean }
      auth_has_tenant_access: { Args: { tid: string }; Returns: boolean }
      auth_is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      get_public_tenant: {
        Args: { p_host: string; p_slug: string | null }
        Returns: {
          brand_id: string
          branding: Json
          id: string
          name: string
          slug: string
        }[]
      }
      get_mobile_app_bootstrap: {
        Args: { p_bundle_id: string }
        Returns: {
          app_id: string
          app_name: string
          app_slug: string
          audience: string
          brand_branding: Json
          brand_id: string
          brand_name: string
          brand_slug: string
          branding: Json
          deep_link_scheme: string | null
          scope_id: string
          scope_type: string
          tenant_branding: Json | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_slug: string | null
        }[]
      }
      next_document_number: {
        Args: { p_doc_type: string; p_tenant_id: string }
        Returns: number
      }
      get_public_services: {
        Args: { p_tenant_id: string }
        Returns: {
          id: string
          name: string
          description: string | null
          duration_min: number
          price_cents: number
          color: string | null
          extras_step_position: string
          image_url: string | null
          booking_mode: string
        }[]
      }
      get_public_quote_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      respond_public_quote: {
        Args: { p_action: string; p_token: string }
        Returns: boolean
      }
      submit_public_quote_request: {
        Args: {
          p_email: string
          p_event_date?: string
          p_full_name: string
          p_message?: string
          p_phone?: string
          p_service_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_public_service_extras: {
        Args: { p_tenant_id: string; p_service_id: string }
        Returns: {
          extra_service_id: string
          name: string
          description: string | null
          duration_min: number
          price_cents: number
          image_url: string | null
          min_qty: number
          max_qty: number
          sort_order: number
        }[]
      }
      get_public_staff_for_service: {
        Args: { p_tenant_id: string; p_service_id: string }
        Returns: { id: string; full_name: string; color: string | null }[]
      }
      get_public_available_slots: {
        Args: {
          p_tenant_id: string
          p_service_id: string
          p_date: string
          p_staff_id?: string
          p_extras?: Json
        }
        Returns: { starts_at: string; ends_at: string; staff_id: string }[]
      }
      book_public_appointment: {
        Args: {
          p_tenant_id: string
          p_service_id: string
          p_staff_id: string
          p_starts_at: string
          p_email: string
          p_full_name: string
          p_phone?: string
          p_extras?: Json
        }
        Returns: string
      }
      inst_booking_duration_min: {
        Args: { p_service_id: string; p_extras?: Json }
        Returns: number
      }
      inst_booking_price_cents: {
        Args: { p_service_id: string; p_extras?: Json }
        Returns: number
      }
      get_public_site_home: {
        Args: { p_tenant_id: string }
        Returns: {
          content: Json
          id: string
          page_type: string
          page_style: Json
          seo_description: string | null
          seo_title: string | null
          slug: string
          template_id: string
          title: string
        }[]
      }
      get_public_site_page: {
        Args: { p_tenant_id: string; p_slug: string }
        Returns: {
          content: Json
          id: string
          page_type: string
          page_style: Json
          seo_description: string | null
          seo_title: string | null
          slug: string
          template_id: string
          title: string
        }[]
      }
      get_public_site_page_by_type: {
        Args: { p_tenant_id: string; p_page_type: string }
        Returns: {
          content: Json
          id: string
          page_type: string
          page_style: Json
          seo_description: string | null
          seo_title: string | null
          slug: string
          template_id: string
          title: string
        }[]
      }
      get_public_site_settings: {
        Args: { p_tenant_id: string }
        Returns: {
          display_name: string | null
          footer_text: string | null
          logo_url: string | null
          primary_color: string
        }[]
      }
      get_public_site_nav: {
        Args: { p_tenant_id: string }
        Returns: {
          id: string
          page_type: string
          slug: string
          sort_order: number
          title: string
        }[]
      }
      get_public_booking_enabled: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      get_public_booking_flow: {
        Args: { p_tenant_id: string; p_slug?: string }
        Returns: {
          id: string
          name: string
          slug: string
          config: Json
        }[]
      }
      get_public_opening_hours: {
        Args: { p_tenant_id: string }
        Returns: {
          weekday: number
          start_time: string
          end_time: string
        }[]
      }
      inst_loyalty_credit: {
        Args: {
          p_client_id: string
          p_idempotency_key: string
          p_notes?: string
          p_points: number
          p_program_id: string
          p_rule_id: string
          p_source_id: string
          p_source_type: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      inst_loyalty_credit_bonus: {
        Args: {
          p_client_id: string
          p_idempotency_key: string
          p_notes?: string
          p_points: number
          p_program_id: string
          p_source_id: string
          p_source_type: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      inst_loyalty_redeem: {
        Args: {
          p_client_id: string
          p_discount_cents: number
          p_idempotency_key: string
          p_notes?: string
          p_points: number
          p_program_id: string
          p_reward_id: string
          p_sale_id: string
          p_tenant_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
