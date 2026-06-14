'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { iniciarAlta } from '@/app/actions/prepaga-actions'
import { updateLeadStage } from '@/app/actions/lead-actions'
import type { LeadCotizacion, PrepagaConCotizador, CotizadorAcceso } from '@/types/cotizacion'

// ---------------------------------------------------------------------------
// Lectura: prepagas asignadas al asesor autenticado
// ---------------------------------------------------------------------------
export async function getPrepagasDelAsesor(): Promise<PrepagaConCotizador[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('prepaga_asesores_safe')
    .select('prepaga_id, activo, prepagas(id, nombre, logo_url, tipo_cotizador, cotizador_url, slug)')
    .eq('asesor_id', user.id)
    .eq('activo', true)

  if (error) { console.error('getPrepagasDelAsesor:', error); return [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => row.prepagas).filter(Boolean) as PrepagaConCotizador[]
}

// ---------------------------------------------------------------------------
// Lectura: cotizaciones de un lead
// ---------------------------------------------------------------------------
export async function getCotizacionesDelLead(leadId: string): Promise<LeadCotizacion[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('lead_cotizaciones')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) { console.error('getCotizacionesDelLead:', error); return [] }
  return (data ?? []) as unknown as LeadCotizacion[]
}

// ---------------------------------------------------------------------------
// Guardar cotización (upsert, estado borrador)
// ---------------------------------------------------------------------------
const GuardarCotizacionSchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  prepaga_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable().optional(),
  integrantes: z.array(z.object({
    rol: z.enum(['titular', 'conyuge', 'hijo', 'otro']),
    edad: z.number().int().min(0).max(99),
  })),
  valor_calculado: z.number().nullable().optional(),
  descuento_aportes: z.number().nullable().optional(),
  descuento_comercial: z.number().nullable().optional(),
  iva: z.number().nullable().optional(),
  valor_final: z.number().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  cotizador_tipo: z.enum(['integrado', 'externo', 'pdf', 'manual']),
})

export async function guardarCotizacion(
  formData: z.infer<typeof GuardarCotizacionSchema>
): Promise<{ data?: LeadCotizacion; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = GuardarCotizacionSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const payload = {
    ...parsed.data,
    asesor_id: user.id,
    estado: 'borrador' as const,
    plan_id: parsed.data.plan_id ?? null,
  }

  let result
  if (parsed.data.id) {
    const { data, error } = await supabase
      .from('lead_cotizaciones')
      .update(payload)
      .eq('id', parsed.data.id)
      .eq('asesor_id', user.id)
      .select()
      .single()
    result = { data, error }
  } else {
    const { data, error } = await supabase
      .from('lead_cotizaciones')
      .insert(payload)
      .select()
      .single()
    result = { data, error }
  }

  if (result.error) return { error: result.error.message }

  revalidatePath(`/leads/${parsed.data.lead_id}`)
  return { data: result.data as unknown as LeadCotizacion }
}

// ---------------------------------------------------------------------------
// Aprobar cotización
// ---------------------------------------------------------------------------
export async function aprobarCotizacion(
  id: string
): Promise<{ data?: LeadCotizacion; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('lead_cotizaciones')
    .update({ estado: 'aprobada' })
    .eq('id', id)
    .eq('asesor_id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }

  const cotizacion = data as unknown as LeadCotizacion
  revalidatePath(`/leads/${cotizacion.lead_id}`)
  return { data: cotizacion }
}

// ---------------------------------------------------------------------------
// Iniciar alta desde cotización aprobada
// ---------------------------------------------------------------------------
export async function iniciarAltaDesdeCotizacion(
  cotizacionId: string
): Promise<{ altaId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: cotizacion, error: fetchError } = await supabase
    .from('lead_cotizaciones')
    .select('*')
    .eq('id', cotizacionId)
    .eq('asesor_id', user.id)
    .single()

  if (fetchError || !cotizacion) return { error: 'Cotización no encontrada' }
  const cot = cotizacion as unknown as LeadCotizacion
  if (cot.estado !== 'aprobada') return { error: 'La cotización debe estar aprobada para iniciar el alta' }

  const altaResult = await iniciarAlta({
    lead_id: cot.lead_id,
    prepaga_id: cot.prepaga_id,
    plan_id: cot.plan_id ?? undefined,
  })

  if (altaResult.error || !altaResult.data) return { error: altaResult.error ?? 'Error al crear el alta' }

  await updateLeadStage(cot.lead_id, 'Alta en Proceso')

  revalidatePath(`/leads/${cot.lead_id}`)
  revalidatePath('/altas')
  return { altaId: altaResult.data.id }
}

// ---------------------------------------------------------------------------
// Obtener acceso al cotizador externo (credenciales via service role)
// ---------------------------------------------------------------------------
export async function getCotizadorAcceso(
  prepagaId: string
): Promise<CotizadorAcceso & { error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, usuario: null, password: null, error: 'No autenticado' }

  // Verificar que el asesor tenga esta prepaga asignada y activa
  const { data: asignada } = await supabase
    .from('prepaga_asesores_safe')
    .select('prepaga_id')
    .eq('asesor_id', user.id)
    .eq('prepaga_id', prepagaId)
    .eq('activo', true)
    .maybeSingle()

  if (!asignada) return { url: null, usuario: null, password: null, error: 'No tenés esta prepaga asignada' }

  // Leer URL del cotizador
  const { data: prepaga } = await supabase
    .from('prepagas')
    .select('cotizador_url')
    .eq('id', prepagaId)
    .single()

  // Leer credenciales via service role (bypasea RLS)
  const admin = createAdminClient()
  const { data: creds } = await admin
    .from('prepaga_credenciales')
    .select('credenciales')
    .eq('prepaga_id', prepagaId)
    .maybeSingle()

  type CredJson = {
    usuario?: string
    password?: string
    pdfs?: Array<{ label: string; url: string }>
  }
  const credJson = creds?.credenciales as CredJson | null

  return {
    url: prepaga?.cotizador_url ?? null,
    usuario: credJson?.usuario ?? null,
    password: credJson?.password ?? null,
    pdfs: credJson?.pdfs ?? [],
  }
}
