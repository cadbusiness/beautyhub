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
          woo_key: string | null
          woo_secret: string | null
          woo_url: string | null
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
          woo_key?: string | null
          woo_secret?: string | null
          woo_url?: string | null
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
          woo_key?: string | null
          woo_secret?: string | null
          woo_url?: string | null
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
          id: string
          name: string
          slug: string
          branding: Json
          brand_id: string
        }[]
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
