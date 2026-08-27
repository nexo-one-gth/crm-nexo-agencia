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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          alta_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string | null
          type: string | null
        }
        Insert: {
          alta_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          type?: string | null
        }
        Update: {
          alta_id?: string | null
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
      admin_asesores: {
        Row: {
          admin_id: string
          asesor_id: string
          created_at: string
        }
        Insert: {
          admin_id: string
          asesor_id: string
          created_at?: string
        }
        Update: {
          admin_id?: string
          asesor_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_asesores_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_asesores_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alta_integrantes: {
        Row: {
          alta_id: string
          altura_cm: number | null
          created_at: string
          cuil: string | null
          dni: string | null
          domicilio: string | null
          edad: number | null
          email: string | null
          fecha_nac: string | null
          fum: string | null
          id: string
          nombre: string | null
          observaciones: string | null
          orden: number
          parentesco: string | null
          peso_kg: number | null
          rol: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          alta_id: string
          altura_cm?: number | null
          created_at?: string
          cuil?: string | null
          dni?: string | null
          domicilio?: string | null
          edad?: number | null
          email?: string | null
          fecha_nac?: string | null
          fum?: string | null
          id?: string
          nombre?: string | null
          observaciones?: string | null
          orden?: number
          parentesco?: string | null
          peso_kg?: number | null
          rol?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          alta_id?: string
          altura_cm?: number | null
          created_at?: string
          cuil?: string | null
          dni?: string | null
          domicilio?: string | null
          edad?: number | null
          email?: string | null
          fecha_nac?: string | null
          fum?: string | null
          id?: string
          nombre?: string | null
          observaciones?: string | null
          orden?: number
          parentesco?: string | null
          peso_kg?: number | null
          rol?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alta_integrantes_alta_id_fkey"
            columns: ["alta_id"]
            isOneToOne: false
            referencedRelation: "altas"
            referencedColumns: ["id"]
          },
        ]
      }
      alta_items: {
        Row: {
          alta_id: string
          archivo_path: string | null
          completado: boolean
          completado_at: string | null
          completado_by: string | null
          drive_file_id: string | null
          drive_file_url: string | null
          etiqueta: string
          id: string
          plantilla_item_id: string | null
          requerido: boolean
          seccion: string
          momento: string
          tipo_dato: string
          valor_fecha: string | null
          valor_numero: number | null
          valor_texto: string | null
        }
        Insert: {
          alta_id: string
          archivo_path?: string | null
          completado?: boolean
          completado_at?: string | null
          completado_by?: string | null
          drive_file_id?: string | null
          drive_file_url?: string | null
          etiqueta: string
          id?: string
          plantilla_item_id?: string | null
          requerido?: boolean
          seccion?: string
          momento?: string
          tipo_dato: string
          valor_fecha?: string | null
          valor_numero?: number | null
          valor_texto?: string | null
        }
        Update: {
          alta_id?: string
          archivo_path?: string | null
          completado?: boolean
          completado_at?: string | null
          completado_by?: string | null
          drive_file_id?: string | null
          drive_file_url?: string | null
          etiqueta?: string
          id?: string
          plantilla_item_id?: string | null
          requerido?: boolean
          seccion?: string
          momento?: string
          tipo_dato?: string
          valor_fecha?: string | null
          valor_numero?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alta_items_alta_id_fkey"
            columns: ["alta_id"]
            isOneToOne: false
            referencedRelation: "altas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alta_items_completado_by_fkey"
            columns: ["completado_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alta_items_plantilla_item_id_fkey"
            columns: ["plantilla_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_plantilla_items"
            referencedColumns: ["id"]
          },
        ]
      }
      altas: {
        Row: {
          aportes_promedio: number | null
          asesor_id: string
          cantidad_capitas: number | null
          created_at: string
          cuota: number | null
          cotizacion_id: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          enviada_at: string | null
          estado: string
          id: string
          lead_id: string
          medio_pago: string | null
          observaciones: string | null
          periodo_aportes: string | null
          plan_codigo: string | null
          plan_id: string | null
          plantilla_id: string | null
          prepaga_id: string
          resumen_drive_id: string | null
          resumen_drive_url: string | null
          resumen_texto: string | null
          sueldo_bruto: number | null
          tipo_alta: string | null
          updated_at: string
        }
        Insert: {
          aportes_promedio?: number | null
          asesor_id: string
          cantidad_capitas?: number | null
          created_at?: string
          cuota?: number | null
          cotizacion_id?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          enviada_at?: string | null
          estado?: string
          id?: string
          lead_id: string
          medio_pago?: string | null
          observaciones?: string | null
          periodo_aportes?: string | null
          plan_codigo?: string | null
          plan_id?: string | null
          plantilla_id?: string | null
          prepaga_id: string
          resumen_drive_id?: string | null
          resumen_drive_url?: string | null
          resumen_texto?: string | null
          sueldo_bruto?: number | null
          tipo_alta?: string | null
          updated_at?: string
        }
        Update: {
          aportes_promedio?: number | null
          asesor_id?: string
          cantidad_capitas?: number | null
          created_at?: string
          cuota?: number | null
          cotizacion_id?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          enviada_at?: string | null
          estado?: string
          id?: string
          lead_id?: string
          medio_pago?: string | null
          observaciones?: string | null
          periodo_aportes?: string | null
          plan_codigo?: string | null
          plan_id?: string | null
          plantilla_id?: string | null
          prepaga_id?: string
          resumen_drive_id?: string | null
          resumen_drive_url?: string | null
          resumen_texto?: string | null
          sueldo_bruto?: number | null
          tipo_alta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "altas_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altas_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prepaga_planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altas_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "checklist_plantillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "altas_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
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
      checklist_plantilla_items: {
        Row: {
          etiqueta: string
          id: string
          orden: number
          plantilla_id: string
          requerido: boolean
          seccion: string
          momento: string
          tipo_dato: string
        }
        Insert: {
          etiqueta: string
          id?: string
          orden?: number
          plantilla_id: string
          requerido?: boolean
          seccion?: string
          momento?: string
          tipo_dato?: string
        }
        Update: {
          etiqueta?: string
          id?: string
          orden?: number
          plantilla_id?: string
          requerido?: boolean
          seccion?: string
          momento?: string
          tipo_dato?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_plantilla_items_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "checklist_plantillas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_plantillas: {
        Row: {
          activa: boolean
          id: string
          nombre: string
          prepaga_id: string
          resumen_template: string | null
          tipo_alta: string | null
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre?: string
          prepaga_id: string
          resumen_template?: string | null
          tipo_alta?: string | null
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
          prepaga_id?: string
          resumen_template?: string | null
          tipo_alta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_plantillas_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      cierres_comisionales: {
        Row: {
          cerrado_at: string | null
          cerrado_by: string | null
          created_at: string
          estado: string
          fecha_cierre: string | null
          fecha_pago_estimada: string | null
          id: string
          liquidado_at: string | null
          liquidado_by: string | null
          mes_periodo: string
          notas: string | null
          prepaga_id: string
        }
        Insert: {
          cerrado_at?: string | null
          cerrado_by?: string | null
          created_at?: string
          estado?: string
          fecha_cierre?: string | null
          fecha_pago_estimada?: string | null
          id?: string
          liquidado_at?: string | null
          liquidado_by?: string | null
          mes_periodo: string
          notas?: string | null
          prepaga_id: string
        }
        Update: {
          cerrado_at?: string | null
          cerrado_by?: string | null
          created_at?: string
          estado?: string
          fecha_cierre?: string | null
          fecha_pago_estimada?: string | null
          id?: string
          liquidado_at?: string | null
          liquidado_by?: string | null
          mes_periodo?: string
          notas?: string | null
          prepaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cierres_comisionales_cerrado_by_fkey"
            columns: ["cerrado_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierres_comisionales_liquidado_by_fkey"
            columns: ["liquidado_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cierres_comisionales_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      comisiones: {
        Row: {
          alta_id: string
          asesor_id: string
          beneficiario_id: string
          cierre_id: string | null
          comision_pct_asesor: number | null
          created_at: string
          estado: string
          id: string
          lead_id: string
          liquidada_at: string | null
          liquidada_by: string | null
          monto_base: number
          monto_comision: number
          notas: string | null
          origen: string | null
          porcentaje: number
          prepaga_id: string
          segmento: string
          supervisor_id: string | null
          tipo: string
          tipo_base: string
          vendedor_id: string
        }
        Insert: {
          alta_id: string
          asesor_id: string
          beneficiario_id: string
          cierre_id?: string | null
          comision_pct_asesor?: number | null
          created_at?: string
          estado?: string
          id?: string
          lead_id: string
          liquidada_at?: string | null
          liquidada_by?: string | null
          monto_base: number
          monto_comision: number
          notas?: string | null
          origen?: string | null
          porcentaje: number
          prepaga_id: string
          segmento: string
          supervisor_id?: string | null
          tipo: string
          tipo_base: string
          vendedor_id: string
        }
        Update: {
          alta_id?: string
          asesor_id?: string
          beneficiario_id?: string
          cierre_id?: string | null
          comision_pct_asesor?: number | null
          created_at?: string
          estado?: string
          id?: string
          lead_id?: string
          liquidada_at?: string | null
          liquidada_by?: string | null
          monto_base?: number
          monto_comision?: number
          notas?: string | null
          origen?: string | null
          porcentaje?: number
          prepaga_id?: string
          segmento?: string
          supervisor_id?: string | null
          tipo?: string
          tipo_base?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_alta_id_fkey"
            columns: ["alta_id"]
            isOneToOne: false
            referencedRelation: "altas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_cierre_id_fkey"
            columns: ["cierre_id"]
            isOneToOne: false
            referencedRelation: "cierres_comisionales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_liquidada_by_fkey"
            columns: ["liquidada_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comisiones_vendedor_id_fkey"
            columns: ["vendedor_id"]
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
      lead_cotizaciones: {
        Row: {
          asesor_id: string
          cotizador_tipo: string
          created_at: string
          descuento_aportes: number | null
          descuento_comercial: number | null
          estado: string
          id: string
          integrantes: Json
          iva: number | null
          lead_id: string
          observaciones: string | null
          plan_id: string | null
          prepaga_id: string
          updated_at: string
          valor_calculado: number | null
          valor_final: number | null
        }
        Insert: {
          asesor_id: string
          cotizador_tipo: string
          created_at?: string
          descuento_aportes?: number | null
          descuento_comercial?: number | null
          estado?: string
          id?: string
          integrantes?: Json
          iva?: number | null
          lead_id: string
          observaciones?: string | null
          plan_id?: string | null
          prepaga_id: string
          updated_at?: string
          valor_calculado?: number | null
          valor_final?: number | null
        }
        Update: {
          asesor_id?: string
          cotizador_tipo?: string
          created_at?: string
          descuento_aportes?: number | null
          descuento_comercial?: number | null
          estado?: string
          id?: string
          integrantes?: Json
          iva?: number | null
          lead_id?: string
          observaciones?: string | null
          plan_id?: string | null
          prepaga_id?: string
          updated_at?: string
          valor_calculado?: number | null
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_cotizaciones_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cotizaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cotizaciones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prepaga_planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cotizaciones_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_city: string | null
          address_state: string | null
          assigned_at: string | null
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
          edades: Json | null
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
          origen: string | null
          phone: string | null
          pipeline_stage_id: string | null
          plan: string | null
          prepaga_id: string | null
          source: string | null
          sueldo_bruto: number | null
          valor_final_socio: number | null
          valor_forecast: number | null
          valor_plan: number | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          assigned_at?: string | null
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
          edades?: Json | null
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
          origen?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          plan?: string | null
          prepaga_id?: string | null
          source?: string | null
          sueldo_bruto?: number | null
          valor_final_socio?: number | null
          valor_forecast?: number | null
          valor_plan?: number | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          assigned_at?: string | null
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
          edades?: Json | null
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
          origen?: string | null
          phone?: string | null
          pipeline_stage_id?: string | null
          plan?: string | null
          prepaga_id?: string | null
          source?: string | null
          sueldo_bruto?: number | null
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
          {
            foreignKeyName: "leads_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
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
      prepaga_asesores: {
        Row: {
          activo: boolean
          asesor_id: string
          codigo_productor: string | null
          comision_pct: number | null
          credenciales: Json
          id: string
          prepaga_id: string
        }
        Insert: {
          activo?: boolean
          asesor_id: string
          codigo_productor?: string | null
          comision_pct?: number | null
          credenciales?: Json
          id?: string
          prepaga_id: string
        }
        Update: {
          activo?: boolean
          asesor_id?: string
          codigo_productor?: string | null
          comision_pct?: number | null
          credenciales?: Json
          id?: string
          prepaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_asesores_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaga_asesores_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaga_comision_reglas: {
        Row: {
          created_at: string
          id: string
          notas: string | null
          origen: string | null
          porcentaje: number
          prepaga_id: string
          segmento: string
          tipo_base: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notas?: string | null
          origen?: string | null
          porcentaje: number
          prepaga_id: string
          segmento: string
          tipo_base: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notas?: string | null
          origen?: string | null
          porcentaje?: number
          prepaga_id?: string
          segmento?: string
          tipo_base?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_comision_reglas_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaga_credenciales: {
        Row: {
          created_at: string | null
          credenciales: Json
          prepaga_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credenciales?: Json
          prepaga_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credenciales?: Json
          prepaga_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_credenciales_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: true
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaga_eventos: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          mes_periodo: string
          nota: string | null
          prepaga_id: string
          segmento: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          mes_periodo: string
          nota?: string | null
          prepaga_id: string
          segmento?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          mes_periodo?: string
          nota?: string | null
          prepaga_id?: string
          segmento?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_eventos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaga_eventos_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaga_planes: {
        Row: {
          activo: boolean
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          prepaga_id: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          prepaga_id: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          prepaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_planes_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaga_tarifas: {
        Row: {
          composicion: string
          created_at: string
          edad_titular_max: number | null
          edad_titular_min: number | null
          id: string
          modalidad: string
          plan_id: string
          precio: number
          prepaga_id: string
          vigencia_desde: string
          vigencia_hasta: string | null
          zona: string
        }
        Insert: {
          composicion: string
          created_at?: string
          edad_titular_max?: number | null
          edad_titular_min?: number | null
          id?: string
          modalidad: string
          plan_id: string
          precio: number
          prepaga_id: string
          vigencia_desde?: string
          vigencia_hasta?: string | null
          zona: string
        }
        Update: {
          composicion?: string
          created_at?: string
          edad_titular_max?: number | null
          edad_titular_min?: number | null
          id?: string
          modalidad?: string
          plan_id?: string
          precio?: number
          prepaga_id?: string
          vigencia_desde?: string
          vigencia_hasta?: string | null
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_tarifas_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prepaga_planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaga_tarifas_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
      prepagas: {
        Row: {
          activa: boolean
          cotizador_url: string | null
          created_at: string
          drive_folder_id: string | null
          id: string
          logo_url: string | null
          nombre: string
          notas_admin: string | null
          orden: number
          slug: string
          tipo_cotizador: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          cotizador_url?: string | null
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          notas_admin?: string | null
          orden?: number
          slug: string
          tipo_cotizador?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          cotizador_url?: string | null
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          notas_admin?: string | null
          orden?: number
          slug?: string
          tipo_cotizador?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aparecer_en_tablero: boolean
          codigo_productor: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string | null
          solo_lectura: boolean
        }
        Insert: {
          aparecer_en_tablero?: boolean
          codigo_productor?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string | null
          solo_lectura?: boolean
        }
        Update: {
          aparecer_en_tablero?: boolean
          codigo_productor?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string | null
          solo_lectura?: boolean
        }
        Relationships: []
      }
      supervisor_overrides: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          id: string
          pct_equipo: number | null
          pct_venta_propia: number | null
          prepaga_id: string
          supervisor_id: string
          vigente_desde: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          pct_equipo?: number | null
          pct_venta_propia?: number | null
          prepaga_id: string
          supervisor_id: string
          vigente_desde?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          pct_equipo?: number | null
          pct_venta_propia?: number | null
          prepaga_id?: string
          supervisor_id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_overrides_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_overrides_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      prepaga_asesores_safe: {
        Row: {
          activo: boolean | null
          asesor_id: string | null
          codigo_productor: string | null
          comision_pct: number | null
          id: string | null
          prepaga_id: string | null
        }
        Insert: {
          activo?: boolean | null
          asesor_id?: string | null
          codigo_productor?: string | null
          comision_pct?: number | null
          id?: string | null
          prepaga_id?: string | null
        }
        Update: {
          activo?: boolean | null
          asesor_id?: string | null
          codigo_productor?: string | null
          comision_pct?: number | null
          id?: string | null
          prepaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prepaga_asesores_asesor_id_fkey"
            columns: ["asesor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepaga_asesores_prepaga_id_fkey"
            columns: ["prepaga_id"]
            isOneToOne: false
            referencedRelation: "prepagas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_asesores_visibles: { Args: never; Returns: string[] }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_admin_principal: { Args: never; Returns: boolean }
      auth_is_supervisor: { Args: never; Returns: boolean }
      auth_puede_asignar: { Args: never; Returns: boolean }
      auth_puede_escribir: { Args: never; Returns: boolean }
      auth_puede_ver_asesor: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      user_role: "admin" | "supervisor" | "sales_executive" | "asesor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "supervisor", "sales_executive", "asesor"],
    },
  },
} as const
