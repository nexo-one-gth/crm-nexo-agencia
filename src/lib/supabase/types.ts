export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          accion: string
          created_at: string
          detalles: Json | null
          duracion_ms: number | null
          error_mensaje: string | null
          execution_id: string | null
          id: string
          recurso_id: string | null
          recurso_tipo: string | null
          resultado: string
          triggered_by: string
          workflow_id: string
        }
        Insert: {
          accion: string
          created_at?: string
          detalles?: Json | null
          duracion_ms?: number | null
          error_mensaje?: string | null
          execution_id?: string | null
          id?: string
          recurso_id?: string | null
          recurso_tipo?: string | null
          resultado: string
          triggered_by: string
          workflow_id: string
        }
        Update: {
          accion?: string
          created_at?: string
          detalles?: Json | null
          duracion_ms?: number | null
          error_mensaje?: string | null
          execution_id?: string | null
          id?: string
          recurso_id?: string | null
          recurso_tipo?: string | null
          resultado?: string
          triggered_by?: string
          workflow_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          active: boolean | null
          advisor_id: string | null
          created_at: string
          created_by: string | null
          daily_rhythm: number
          description: string | null
          id: string
          name: string
          total_leads: number
        }
        Insert: {
          active?: boolean | null
          advisor_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_rhythm: number
          description?: string | null
          id?: string
          name: string
          total_leads: number
        }
        Update: {
          active?: boolean | null
          advisor_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_rhythm?: number
          description?: string | null
          id?: string
          name?: string
          total_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_global: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      conversacion_mensajes: {
        Row: {
          contenido: string | null
          conversacion_id: string
          direccion: string
          enviado_por: string | null
          estado: string
          evolution_message_id: string | null
          id: string
          media_url: string | null
          metadata: Json | null
          timestamp: string
          tipo: string
          triggered_by_automation: boolean | null
          workflow_id: string | null
        }
        Insert: {
          contenido?: string | null
          conversacion_id: string
          direccion: string
          enviado_por?: string | null
          estado?: string
          evolution_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          timestamp?: string
          tipo: string
          triggered_by_automation?: boolean | null
          workflow_id?: string | null
        }
        Update: {
          contenido?: string | null
          conversacion_id?: string
          direccion?: string
          enviado_por?: string | null
          estado?: string
          evolution_message_id?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json | null
          timestamp?: string
          tipo?: string
          triggered_by_automation?: boolean | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string
          estado: string
          id: string
          instancia_whatsapp_id: string | null
          lead_id: string | null
          no_leidos: number | null
          numero_whatsapp: string
          perfil_id: string
          ultimo_mensaje_at: string | null
          ultimo_mensaje_preview: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          instancia_whatsapp_id?: string | null
          lead_id?: string | null
          no_leidos?: number | null
          numero_whatsapp: string
          perfil_id: string
          ultimo_mensaje_at?: string | null
          ultimo_mensaje_preview?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          instancia_whatsapp_id?: string | null
          lead_id?: string | null
          no_leidos?: number | null
          numero_whatsapp?: string
          perfil_id?: string
          ultimo_mensaje_at?: string | null
          ultimo_mensaje_preview?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_instancia_whatsapp_id_fkey"
            columns: ["instancia_whatsapp_id"]
            isOneToOne: false
            referencedRelation: "instancias_whatsapp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instancias_whatsapp: {
        Row: {
          created_at: string
          estado: string
          evolution_instance_name: string
          id: string
          metadata: Json | null
          nombre: string
          numero_whatsapp: string | null
          perfil_id: string | null
          ultima_conexion: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          estado?: string
          evolution_instance_name: string
          id?: string
          metadata?: Json | null
          nombre: string
          numero_whatsapp?: string | null
          perfil_id?: string | null
          ultima_conexion?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          evolution_instance_name?: string
          id?: string
          metadata?: Json | null
          nombre?: string
          numero_whatsapp?: string | null
          perfil_id?: string | null
          ultima_conexion?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instancias_whatsapp_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_city: string | null
          address_state: string | null
          assigned_to: string | null
          campaign_id: string | null
          cantidad_integrantes: number | null
          created_at: string
          created_by: string | null
          cuil: string | null
          cuit_empleador: string | null
          deleted_at: string | null
          descuento_aportes: number | null
          descuento_comercial: number | null
          discard_reason: string | null
          dni: string | null
          documentacion_pendiente: string | null
          edades: string | null
          email: string | null
          etapa_historial: Json | null
          first_name: string
          id: string
          interest_level: number | null
          is_contacted: boolean | null
          is_lost: boolean | null
          iva: number | null
          last_name: string | null
          last_status_update_at: string | null
          lost_reason_id: string | null
          notes: string | null
          numero_tramite: string | null
          obra_social: string | null
          observaciones_cotizacion: string | null
          phone: string | null
          pipeline_stage_id: string | null
          plan: string | null
          source: string | null
          valor_final_socio: number | null
          valor_forecast: number | null
          valor_plan: number | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          cantidad_integrantes?: number | null
          created_at?: string
          created_by?: string | null
          cuil?: string | null
          cuit_empleador?: string | null
          deleted_at?: string | null
          descuento_aportes?: number | null
          descuento_comercial?: number | null
          discard_reason?: string | null
          dni?: string | null
          documentacion_pendiente?: string | null
          edades?: string | null
          email?: string | null
          etapa_historial?: Json | null
          first_name: string
          id?: string
          interest_level?: number | null
          is_contacted?: boolean | null
          is_lost?: boolean | null
          iva?: number | null
          last_name?: string | null
          last_status_update_at?: string | null
          lost_reason_id?: string | null
          notes?: string | null
          numero_tramite?: string | null
          obra_social?: string | null
          observaciones_cotizacion?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          plan?: string | null
          source?: string | null
          valor_final_socio?: number | null
          valor_forecast?: number | null
          valor_plan?: number | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          assigned_to?: string | null
          campaign_id?: string | null
          cantidad_integrantes?: number | null
          created_at?: string
          created_by?: string | null
          cuil?: string | null
          cuit_empleador?: string | null
          deleted_at?: string | null
          descuento_aportes?: number | null
          descuento_comercial?: number | null
          discard_reason?: string | null
          dni?: string | null
          documentacion_pendiente?: string | null
          edades?: string | null
          email?: string | null
          etapa_historial?: Json | null
          first_name?: string
          id?: string
          interest_level?: number | null
          is_contacted?: boolean | null
          is_lost?: boolean | null
          iva?: number | null
          last_name?: string | null
          last_status_update_at?: string | null
          lost_reason_id?: string | null
          notes?: string | null
          numero_tramite?: string | null
          obra_social?: string | null
          observaciones_cotizacion?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          plan?: string | null
          source?: string | null
          valor_final_socio?: number | null
          valor_forecast?: number | null
          valor_plan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          id: string
          reason: string
        }
        Insert: {
          id?: string
          reason: string
        }
        Update: {
          id?: string
          reason?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          name: string
          order: number
        }
        Insert: {
          id?: string
          name: string
          order?: number
        }
        Update: {
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
        }
        Relationships: []
      }
      workflows: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          estadisticas: Json | null
          id: string
          n8n_workflow_id: string | null
          nombre: string
          triggers: string[] | null
          ultima_ejecucion: string | null
          updated_at: string
          webhook_url: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          estadisticas?: Json | null
          id?: string
          n8n_workflow_id?: string | null
          nombre: string
          triggers?: string[] | null
          ultima_ejecucion?: string | null
          updated_at?: string
          webhook_url: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          estadisticas?: Json | null
          id?: string
          n8n_workflow_id?: string | null
          nombre?: string
          triggers?: string[] | null
          ultima_ejecucion?: string | null
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      user_role: "admin" | "supervisor" | "sales_executive" | "asesor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
