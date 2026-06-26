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
          created_at: string
          email: string
          full_name: string | null
          id: string
          marketing_opt_in: boolean
          metadata: Json
          password_hash: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          metadata?: Json
          password_hash?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          metadata?: Json
          password_hash?: string | null
          phone?: string | null
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
      inst_products: {
        Row: {
          created_at: string
          currency: string
          id: string
          image_url: string | null
          name: string
          price_cents: number
          sku: string | null
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
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inst_resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_sale_items: {
        Row: {
          id: string
          name: string
          product_id: string | null
          quantity: number
          sale_id: string
          tenant_id: string
          unit_price_cents: number
        }
        Insert: {
          id?: string
          name: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          tenant_id: string
          unit_price_cents?: number
        }
        Update: {
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          tenant_id?: string
          unit_price_cents?: number
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
            foreignKeyName: "inst_sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inst_sales: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          currency: string
          id: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          total_cents: number
          updated_at: string
          woo_order_id: number | null
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id: string
          total_cents?: number
          updated_at?: string
          woo_order_id?: number | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          total_cents?: number
          updated_at?: string
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
      inst_services: {
        Row: {
          buffer_after_min: number
          buffer_before_min: number
          color: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number
          id: string
          is_active: boolean
          max_advance_days: number
          min_advance_hours: number
          name: string
          price_cents: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          buffer_after_min?: number
          buffer_before_min?: number
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          is_active?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name: string
          price_cents?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          buffer_after_min?: number
          buffer_before_min?: number
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          is_active?: boolean
          max_advance_days?: number
          min_advance_hours?: number
          name?: string
          price_cents?: number
          tenant_id?: string
          updated_at?: string
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
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inst_staff_tenant_id_fkey"
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
      memberships: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          role: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          role: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string | null
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
      modules: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          version: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id: string
          name: string
          version?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
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
          created_at: string
          custom_domain: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          branding?: Json
          created_at?: string
          custom_domain?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          branding?: Json
          created_at?: string
          custom_domain?: string | null
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
      get_public_services: {
        Args: { p_tenant_id: string }
        Returns: {
          id: string
          name: string
          description: string | null
          duration_min: number
          price_cents: number
          color: string | null
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
