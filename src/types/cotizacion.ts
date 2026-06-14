import type { TipoCotizador } from '@/app/actions/prepaga-actions'

export interface Integrante {
  rol: 'titular' | 'conyuge' | 'hijo' | 'otro'
  edad: number
}

export interface LeadCotizacion {
  id: string
  lead_id: string
  prepaga_id: string
  plan_id: string | null
  asesor_id: string
  integrantes: Integrante[]
  valor_calculado: number | null
  descuento_aportes: number | null
  descuento_comercial: number | null
  iva: number | null
  valor_final: number | null
  observaciones: string | null
  estado: 'borrador' | 'enviada' | 'aprobada'
  cotizador_tipo: TipoCotizador
  created_at: string
  updated_at: string
}

export interface PrepagaConCotizador {
  id: string
  nombre: string
  logo_url: string | null
  tipo_cotizador: TipoCotizador
  cotizador_url: string | null
  slug: string
}

export interface CotizadorAcceso {
  url: string | null
  usuario: string | null
  password: string | null
}
