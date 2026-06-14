'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LeadCotizacion, PrepagaConCotizador, Integrante } from '@/types/cotizacion'
import {
  getPrepagasDelAsesor,
  getCotizacionesDelLead,
  guardarCotizacion,
  aprobarCotizacion,
} from '@/app/actions/cotizacion-actions'

interface UseCotizacionReturn {
  prepagasDelAsesor: PrepagaConCotizador[]
  cotizacionesDelLead: LeadCotizacion[]
  loading: boolean
  error: string | null
  guardar: (data: GuardarParams) => Promise<LeadCotizacion | null>
  aprobar: (id: string) => Promise<LeadCotizacion | null>
  refetch: () => void
}

export interface GuardarParams {
  id?: string
  lead_id: string
  prepaga_id: string
  plan_id?: string | null
  integrantes: Integrante[]
  valor_calculado?: number | null
  descuento_aportes?: number | null
  descuento_comercial?: number | null
  iva?: number | null
  valor_final?: number | null
  observaciones?: string | null
  cotizador_tipo: 'integrado' | 'externo' | 'pdf' | 'manual'
}

export function useCotizacion(leadId: string): UseCotizacionReturn {
  const [prepagasDelAsesor, setPrepagasDelAsesor] = useState<PrepagaConCotizador[]>([])
  const [cotizacionesDelLead, setCotizacionesDelLead] = useState<LeadCotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getPrepagasDelAsesor(),
      getCotizacionesDelLead(leadId),
    ])
      .then(([prepagas, cotizaciones]) => {
        if (cancelled) return
        setPrepagasDelAsesor(prepagas)
        setCotizacionesDelLead(cotizaciones)
      })
      .catch(err => {
        if (cancelled) return
        setError(err?.message ?? 'Error al cargar datos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [leadId, tick])

  const guardar = useCallback(async (data: GuardarParams): Promise<LeadCotizacion | null> => {
    const result = await guardarCotizacion(data)
    if (result.error) { setError(result.error); return null }
    refetch()
    return result.data ?? null
  }, [refetch])

  const aprobar = useCallback(async (id: string): Promise<LeadCotizacion | null> => {
    const result = await aprobarCotizacion(id)
    if (result.error) { setError(result.error); return null }
    refetch()
    return result.data ?? null
  }, [refetch])

  return { prepagasDelAsesor, cotizacionesDelLead, loading, error, guardar, aprobar, refetch }
}
