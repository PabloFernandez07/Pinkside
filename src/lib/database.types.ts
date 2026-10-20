// Tipos generados desde Supabase (proyecto pinkside). Regenerar tras cada migración.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      app_settings: {
        Row: { key: string; value: Json }
        Insert: { key: string; value: Json }
        Update: { key?: string; value?: Json }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          author_name: string
          created_at: string
          id: number
          member_id: string
          reason: string
          reverses_id: number | null
        }
        Insert: {
          amount: number
          author_name: string
          created_at?: string
          id?: never
          member_id: string
          reason: string
          reverses_id?: number | null
        }
        Update: {
          amount?: number
          author_name?: string
          created_at?: string
          id?: never
          member_id?: string
          reason?: string
          reverses_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'cash_movements_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_movements_reverses_id_fkey'
            columns: ['reverses_id']
            isOneToOne: false
            referencedRelation: 'cash_movements'
            referencedColumns: ['id']
          },
        ]
      }
      recipes: {
        Row: {
          archived: boolean
          craft_location: string
          created_at: string
          id: number
          name: string
          notes: string | null
          output_item_id: number | null
          output_qty: number
          sale_price: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: never
          name: string
          notes?: string | null
          output_item_id?: number | null
          output_qty?: number
          sale_price?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: never
          name?: string
          notes?: string | null
          output_item_id?: number | null
          output_qty?: number
          sale_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipes_output_item_id_fkey'
            columns: ['output_item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_ingredients: {
        Row: { item_id: number; quantity: number; recipe_id: number }
        Insert: { item_id: number; quantity: number; recipe_id: number }
        Update: { item_id?: number; quantity?: number; recipe_id?: number }
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      items: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          id: number
          image_path: string | null
          min_stock: number
          name: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          id?: never
          min_stock?: number
          name: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          id?: never
          min_stock?: number
          name?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          author_name: string
          created_at: string
          delta: number
          id: number
          item_id: number
          member_id: string
          reason: string
          reverses_id: number | null
        }
        Insert: {
          author_name: string
          created_at?: string
          delta: number
          id?: never
          item_id: number
          member_id: string
          reason: string
          reverses_id?: number | null
        }
        Update: {
          author_name?: string
          created_at?: string
          delta?: number
          id?: never
          item_id?: number
          member_id?: string
          reason?: string
          reverses_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_reverses_id_fkey'
            columns: ['reverses_id']
            isOneToOne: false
            referencedRelation: 'stock_movements'
            referencedColumns: ['id']
          },
        ]
      }
      permissions: {
        Row: { description: string; key: string; label: string }
        Insert: { description?: string; key: string; label: string }
        Update: { description?: string; key?: string; label?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          accent: string
          avatar_url: string | null
          created_at: string
          discord_id: string
          discord_username: string | null
          dm_urgent: boolean
          first_name: string | null
          id: string
          last_name: string | null
          map_access: boolean
          motto: string | null
          phone: string | null
          rank_id: number | null
          state_id: number | null
          status: Database['public']['Enums']['member_status']
          theme: string
          updated_at: string
        }
        Insert: {
          accent?: string
          avatar_url?: string | null
          created_at?: string
          discord_id: string
          discord_username?: string | null
          dm_urgent?: boolean
          first_name?: string | null
          id: string
          last_name?: string | null
          motto?: string | null
          phone?: string | null
          rank_id?: number | null
          state_id?: number | null
          status?: Database['public']['Enums']['member_status']
          theme?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          avatar_url?: string | null
          created_at?: string
          discord_id?: string
          discord_username?: string | null
          dm_urgent?: boolean
          first_name?: string | null
          id?: string
          last_name?: string | null
          motto?: string | null
          phone?: string | null
          rank_id?: number | null
          state_id?: number | null
          status?: Database['public']['Enums']['member_status']
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_rank_id_fkey'
            columns: ['rank_id']
            isOneToOne: false
            referencedRelation: 'ranks'
            referencedColumns: ['id']
          },
        ]
      }
      rank_permissions: {
        Row: { permission: string; rank_id: number }
        Insert: { permission: string; rank_id: number }
        Update: { permission?: string; rank_id?: number }
        Relationships: [
          {
            foreignKeyName: 'rank_permissions_permission_fkey'
            columns: ['permission']
            isOneToOne: false
            referencedRelation: 'permissions'
            referencedColumns: ['key']
          },
          {
            foreignKeyName: 'rank_permissions_rank_id_fkey'
            columns: ['rank_id']
            isOneToOne: false
            referencedRelation: 'ranks'
            referencedColumns: ['id']
          },
        ]
      }
      ranks: {
        Row: { created_at: string; id: number; level: number; name: string }
        Insert: { created_at?: string; id?: never; level: number; name: string }
        Update: { created_at?: string; id?: never; level?: number; name?: string }
        Relationships: []
      }
      allowed_discord_ids: {
        Row: {
          added_by: string | null
          added_by_name: string
          created_at: string
          discord_id: string
          label: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      access_log: {
        Row: {
          created_at: string
          discord_id: string
          discord_username: string | null
          event: string
          id: number
          ip: string | null
          member_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      band_actions: {
        Row: {
          created_at: string
          id: number
          kind: string
          member_id: string | null
          member_name: string
          note: string | null
          qty: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      weekly_reports: {
        Row: {
          sections: Json
          updated_at: string
          updated_by: string | null
          updated_by_name: string
          week_start: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      map_areas: {
        Row: {
          author_id: string | null
          author_name: string
          color: string
          created_at: string
          id: number
          name: string
          note: string | null
          points: Json
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      map_icons: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          emoji: string
          id: number
          note: string | null
          title: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      map_markers: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          icon_id: number
          id: number
          updated_at: string
          x: number
          y: number
        }
        Insert: never
        Update: never
        Relationships: []
      }
      urgent_notifications: {
        Row: {
          created_at: string
          error: string | null
          id: number
          kind: string
          recipient_id: string
          request_id: number
          sent_at: string | null
          status: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'urgent_notifications_request_id_fkey'
            columns: ['request_id']
            isOneToOne: false
            referencedRelation: 'urgent_requests'
            referencedColumns: ['id']
          },
        ]
      }
      rank_requirements: {
        Row: { metric: string; rank_id: number; target: number }
        Insert: never
        Update: never
        Relationships: []
      }
      wall_posts: {
        Row: { author_id: string | null; author_name: string; body: string; created_at: string; id: number; pinned: boolean }
        Insert: never
        Update: never
        Relationships: []
      }
      wall_reactions: {
        Row: { emoji: string; member_id: string; post_id: number }
        Insert: never
        Update: never
        Relationships: []
      }
      urgent_requests: {
        Row: {
          author_id: string | null
          author_name: string
          body: string | null
          closed_at: string | null
          closed_by_name: string | null
          created_at: string
          id: number
          item_id: number | null
          priority: string
          status: string
          title: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      activity_feed: {
        Row: {
          amount: number | null
          author_name: string | null
          created_at: string | null
          detail: string | null
          id: number | null
          is_reversal: boolean | null
          item_name: string | null
          kind: string | null
        }
        Relationships: []
      }
      cash_summary: {
        Row: {
          balance: number | null
          expense_7d: number | null
          income_7d: number | null
          movements: number | null
        }
        Relationships: []
      }
      inventory_overview: {
        Row: {
          archived: boolean | null
          category: string | null
          created_at: string | null
          id: number | null
          image_path: string | null
          min_stock: number | null
          name: string | null
          stock: number | null
          unit_cost: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_map_area: { Args: { p_id: number }; Returns: undefined }
      delete_map_marker: { Args: { p_id: number }; Returns: undefined }
      save_map_area: {
        Args: { p_color: string; p_id: number; p_name: string; p_note: string; p_points: Json }
        Returns: number
      }
      save_map_marker: {
        Args: { p_icon_id: number; p_id: number; p_x: number; p_y: number }
        Returns: number
      }
      save_map_icon: {
        Args: { p_emoji: string; p_id: number; p_note: string; p_title: string }
        Returns: number
      }
      delete_map_icon: { Args: { p_id: number }; Returns: undefined }
      can_view_map: { Args: Record<PropertyKey, never>; Returns: boolean }
      set_member_map_access: { Args: { p_member: string; p_value: boolean }; Returns: undefined }
      get_disabled_sections: { Args: Record<PropertyKey, never>; Returns: string[] }
      log_band_action: {
        Args: { p_kind: string; p_note: string | null; p_qty: number }
        Returns: undefined
      }
      delete_band_action: { Args: { p_id: number }; Returns: undefined }
      band_action_counts: {
        Args: { p_week: string }
        Returns: { kind: string; members: number; total: number }[]
      }
      save_weekly_report: {
        Args: { p_week: string; p_sections: Json }
        Returns: undefined
      }
      set_section_disabled: {
        Args: { p_disabled: boolean; p_section: string }
        Returns: undefined
      }
      add_allowed_discord_id: {
        Args: { p_discord_id: string; p_label: string }
        Returns: undefined
      }
      remove_allowed_discord_id: { Args: { p_discord_id: string }; Returns: undefined }
      approve_member: {
        Args: { p_member: string; p_rank: number }
        Returns: undefined
      }
      band_stats: {
        Args: { p_member?: string }
        Returns: {
          avatar_url: string
          cash_moves: number
          crafts: number
          joined_at: string
          member_id: string
          member_name: string
          motto: string
          points_30d: number
          rank_level: number
          rank_name: string
          stock_moves: number
          urgents: number
        }[]
      }
      set_rank_requirement: { Args: { p_metric: string; p_rank: number; p_target: number }; Returns: undefined }
      post_wall: { Args: { p_body: string; p_pinned: boolean }; Returns: number }
      delete_wall_post: { Args: { p_id: number }; Returns: undefined }
      set_wall_pinned: { Args: { p_id: number; p_pinned: boolean }; Returns: undefined }
      toggle_wall_reaction: { Args: { p_emoji: string; p_post: number }; Returns: undefined }
      cash_by_member: {
        Args: Record<PropertyKey, never>
        Returns: {
          deposited: number
          member_id: string
          member_name: string
          movements: number
          net: number
          withdrawn: number
        }[]
      }
      cash_daily: {
        Args: { p_days?: number }
        Returns: { balance: number; day: string; expense: number; income: number }[]
      }
      close_urgent_request: {
        Args: { p_id: number; p_status: string }
        Returns: undefined
      }
      create_urgent_request: {
        Args: { p_body: string; p_item_id: number; p_priority: string; p_recipients: string[]; p_title: string }
        Returns: number
      }
      complete_onboarding: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_state_id: number
        }
        Returns: Database['public']['Enums']['member_status']
      }
      craft_recipe: {
        Args: { p_batches: number; p_recipe: number }
        Returns: Json
      }
      delete_recipe: { Args: { p_id: number }; Returns: undefined }
      save_recipe: {
        Args: {
          p_craft_location?: string
          p_id: number
          p_ingredients: Json
          p_name: string
          p_new_item?: Json
          p_notes: string
          p_output_item: number
          p_output_qty: number
          p_sale_price: number
        }
        Returns: number
      }
      set_recipe_archived: {
        Args: { p_archived: boolean; p_id: number }
        Returns: undefined
      }
      create_item: {
        Args: {
          p_category: string
          p_min_stock: number
          p_name: string
          p_unit_cost: number
        }
        Returns: number
      }
      create_items_bulk: { Args: { p_items: Json }; Returns: Json }
      create_rank: {
        Args: { p_level: number; p_name: string }
        Returns: number
      }
      delete_rank: { Args: { p_rank: number }; Returns: undefined }
      has_perm: { Args: { p_permission: string }; Returns: boolean }
      is_active_member: { Args: never; Returns: boolean }
      is_auditor: { Args: never; Returns: boolean }
      log_access: { Args: { p_ip: string; p_user_agent: string }; Returns: undefined }
      my_rank_level: { Args: never; Returns: number }
      my_cash_balance: { Args: never; Returns: number }
      set_cash_balance: { Args: { p_balance: number }; Returns: number }
      register_stock_movement: {
        Args: {
          p_item: number
          p_kind: string
          p_qty: number
          p_reason: string
        }
        Returns: number
      }
      reverse_cash_movement: {
        Args: { p_id: number; p_reason: string }
        Returns: number
      }
      reverse_stock_movement: {
        Args: { p_id: number; p_reason: string }
        Returns: number
      }
      set_item_archived: {
        Args: { p_archived: boolean; p_id: number }
        Returns: undefined
      }
      set_item_image: {
        Args: { p_id: number; p_path: string }
        Returns: string
      }
      set_member_blocked: {
        Args: { p_blocked: boolean; p_member: string }
        Returns: undefined
      }
      set_member_rank: {
        Args: { p_member: string; p_rank: number }
        Returns: undefined
      }
      set_rank_permission: {
        Args: { p_allowed: boolean; p_permission: string; p_rank: number }
        Returns: undefined
      }
      update_item: {
        Args: {
          p_category: string
          p_id: number
          p_min_stock: number
          p_name: string
          p_unit_cost: number
        }
        Returns: undefined
      }
      update_rank: {
        Args: { p_level: number; p_name: string; p_rank: number }
        Returns: undefined
      }
    }
    Enums: {
      member_status: 'onboarding' | 'pending' | 'active' | 'blocked' | 'denied'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      member_status: ['onboarding', 'pending', 'active', 'blocked', 'denied'],
    },
  },
} as const
