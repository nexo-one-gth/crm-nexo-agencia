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

  // Log de trazabilidad: solo en la primera cotización (no en cada edición de borrador)
  if (!parsed.data.id) {
    const valorFinal = parsed.data.valor_final
    const descripcion = valorFinal
      ? `Cotización generada: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valorFinal)}`
      : 'Cotización generada'
    const { error: logError } = await supabase
      .from('activities')
      .insert({
        lead_id: parsed.data.lead_id,
        created_by: user.id,
        type: 'cotizacion_generada',
        description: descripcion
      })
    if (logError) console.error('Error logging cotizacion_generada activity:', logError)
  }

  // Sync: reflejar los campos de cotización en el lead para dashboard y forecast
  let planNombre: string | null = null
  if (parsed.data.plan_id) {
    const { data: planData } = await supabase
      .from('prepaga_planes')
      .select('nombre')
      .eq('id', parsed.data.plan_id)
      .single()
    planNombre = planData?.nombre ?? null
  }

  await supabase
    .from('leads')
    .update({
      prepaga_id: parsed.data.prepaga_id,
      ...(planNombre !== null ? { plan: planNombre } : {}),
      valor_plan: parsed.data.valor_calculado ?? null,
      descuento_aportes: parsed.data.descuento_aportes ?? null,
      descuento_comercial: parsed.data.descuento_comercial ?? null,
      iva: parsed.data.iva ?? null,
      valor_final_socio: parsed.data.valor_final ?? null,
      valor_forecast: parsed.data.valor_final ?? null,
      observaciones_cotizacion: parsed.data.observaciones ?? null,
    })
    .eq('id', parsed.data.lead_id)

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
// Cotizador interno Premedic
// ---------------------------------------------------------------------------

interface CalcularTarifaParams {
  prepaga_id: string
  plan_id: string
  zona: 'amba' | 'interior'
  modalidad: 'directo' | 'desregulado'
  integrantes: import('@/types/cotizacion').Integrante[]
}

export interface ResultadoTarifa {
  precio_base: number
  adicionales: number
  total: number
  composicion: string
  requiere_auditoria: boolean
  cotiza_central: boolean
  desglose: { concepto: string; precio: number }[]
  vigencia_desde: string
  error?: string
}

function determinarComposicion(
  integrantes: import('@/types/cotizacion').Integrante[]
): { composicion: string; hijosExtra: number; tieneNenio: boolean } {
  const tieneConyuge = integrantes.some(i => i.rol === 'conyuge')
  const hijos = integrantes.filter(i => i.rol === 'hijo')
  const tieneNenio = hijos.some(h => h.edad === 0)

  if (!tieneConyuge && hijos.length === 0) return { composicion: 'individual', hijosExtra: 0, tieneNenio }
  if (tieneConyuge && hijos.length === 0) return { composicion: 'matrimonio', hijosExtra: 0, tieneNenio }
  if (tieneConyuge && hijos.length === 1) return { composicion: 'matrimonio_1hijo', hijosExtra: 0, tieneNenio }
  if (tieneConyuge && hijos.length === 2) return { composicion: 'matrimonio_2hijos', hijosExtra: 0, tieneNenio }
  if (tieneConyuge && hijos.length >= 3) return { composicion: 'matrimonio_3hijos', hijosExtra: hijos.length - 3, tieneNenio }
  // titular solo con hijos (sin cónyuge): se trata como individual + adicionales
  return { composicion: 'individual', hijosExtra: hijos.length, tieneNenio }
}

export async function calcularTarifaPremedic(
  params: CalcularTarifaParams
): Promise<ResultadoTarifa> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { precio_base: 0, adicionales: 0, total: 0, composicion: '', requiere_auditoria: false, cotiza_central: false, desglose: [], vigencia_desde: '', error: 'No autenticado' }

  const titular = params.integrantes.find(i => i.rol === 'titular')
  if (!titular) return { precio_base: 0, adicionales: 0, total: 0, composicion: '', requiere_auditoria: false, cotiza_central: false, desglose: [], vigencia_desde: '', error: 'No hay titular en el grupo' }

  const edadTitular = titular.edad

  // Titular 65+: cotiza central (para todos los planes excepto nunca aplica C-100/200 tampoco)
  if (edadTitular >= 65) {
    return { precio_base: 0, adicionales: 0, total: 0, composicion: '', requiere_auditoria: false, cotiza_central: true, desglose: [], vigencia_desde: '' }
  }

  // Plan C-100 solo en AMBA
  if (params.zona === 'interior') {
    // Validar que el plan no sea C-100 — lo dejaremos que falle en DB si no existe la tarifa
  }

  const { composicion, hijosExtra, tieneNenio } = determinarComposicion(params.integrantes)

  // Para 60-64: usamos edad 59 como base (rango 50-59) y luego sumamos recargos
  const edadBusqueda = edadTitular >= 60 && edadTitular <= 64 ? 59 : edadTitular

  // Buscar tarifa base
  const { data: tarifaBase, error: errBase } = await supabase
    .from('prepaga_tarifas')
    .select('precio, vigencia_desde, composicion')
    .eq('prepaga_id', params.prepaga_id)
    .eq('plan_id', params.plan_id)
    .eq('zona', params.zona)
    .eq('modalidad', params.modalidad)
    .eq('composicion', composicion)
    .lte('edad_titular_min', edadBusqueda)
    .gte('edad_titular_max', edadBusqueda)
    .is('vigencia_hasta', null)
    .maybeSingle()

  if (errBase) return { precio_base: 0, adicionales: 0, total: 0, composicion, requiere_auditoria: false, cotiza_central: false, desglose: [], vigencia_desde: '', error: errBase.message }
  if (!tarifaBase) return { precio_base: 0, adicionales: 0, total: 0, composicion, requiere_auditoria: false, cotiza_central: false, desglose: [], vigencia_desde: '', error: `No se encontró tarifa para la combinación seleccionada (${composicion}, zona: ${params.zona}, modalidad: ${params.modalidad})` }

  const desglose: { concepto: string; precio: number }[] = []
  let precioBase = Number(tarifaBase.precio)
  let adicionales = 0
  const vigenciaDesde = tarifaBase.vigencia_desde

  desglose.push({ concepto: composicion.replace(/_/g, ' '), precio: precioBase })

  // Recargos 60-64
  if (edadTitular >= 60 && edadTitular <= 64) {
    const { data: recargo1 } = await supabase
      .from('prepaga_tarifas')
      .select('precio')
      .eq('prepaga_id', params.prepaga_id)
      .eq('plan_id', params.plan_id)
      .eq('zona', params.zona)
      .eq('modalidad', params.modalidad)
      .eq('composicion', 'recargo_60_64_1')
      .is('vigencia_hasta', null)
      .maybeSingle()

    if (recargo1) {
      const r1 = Number(recargo1.precio)
      precioBase += r1
      desglose.push({ concepto: 'Recargo 60-64 (titular)', precio: r1 })
    }

    // Si hay cónyuge también mayor de 60: recargo_60_64_2
    const conyuge = params.integrantes.find(i => i.rol === 'conyuge')
    if (conyuge && conyuge.edad >= 60) {
      const { data: recargo2 } = await supabase
        .from('prepaga_tarifas')
        .select('precio')
        .eq('prepaga_id', params.prepaga_id)
        .eq('plan_id', params.plan_id)
        .eq('zona', params.zona)
        .eq('modalidad', params.modalidad)
        .eq('composicion', 'recargo_60_64_2')
        .is('vigencia_hasta', null)
        .maybeSingle()

      if (recargo2) {
        const r2 = Number(recargo2.precio)
        precioBase += r2
        desglose.push({ concepto: 'Recargo 60-64 (cónyuge)', precio: r2 })
      }
    }
  }

  // Menor de 1 año
  if (tieneNenio) {
    const { data: tarifaNenio } = await supabase
      .from('prepaga_tarifas')
      .select('precio')
      .eq('prepaga_id', params.prepaga_id)
      .eq('plan_id', params.plan_id)
      .eq('zona', params.zona)
      .eq('modalidad', params.modalidad)
      .eq('composicion', 'adicional_menor1')
      .is('vigencia_hasta', null)
      .maybeSingle()

    if (tarifaNenio) {
      const p = Number(tarifaNenio.precio)
      adicionales += p
      desglose.push({ concepto: 'Adicional menor 1 año', precio: p })
    }
  }

  // Hijos extra más allá del 3ro
  if (hijosExtra > 0) {
    const { data: tarifaAdicional } = await supabase
      .from('prepaga_tarifas')
      .select('precio')
      .eq('prepaga_id', params.prepaga_id)
      .eq('plan_id', params.plan_id)
      .eq('zona', params.zona)
      .eq('modalidad', params.modalidad)
      .eq('composicion', 'adicional_menor25')
      .is('vigencia_hasta', null)
      .maybeSingle()

    if (tarifaAdicional) {
      const p = Number(tarifaAdicional.precio) * hijosExtra
      adicionales += p
      desglose.push({ concepto: `Hijos adicionales (×${hijosExtra})`, precio: p })
    }
  }

  // Requiere auditoría: planes 300/400/500 para mayores de 59
  const { data: planData } = await supabase
    .from('prepaga_planes')
    .select('nombre')
    .eq('id', params.plan_id)
    .single()

  const planNombre = planData?.nombre ?? ''
  const planesConAuditoria = ['300', '400', '500']
  const requiereAuditoria = edadTitular > 59 && planesConAuditoria.some(p => planNombre.includes(p))

  const total = precioBase + adicionales

  return {
    precio_base: precioBase,
    adicionales,
    total,
    composicion,
    requiere_auditoria: requiereAuditoria,
    cotiza_central: false,
    desglose,
    vigencia_desde: vigenciaDesde,
  }
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
