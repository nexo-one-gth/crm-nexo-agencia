'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, isAdminRole } from '@/lib/supabase/assert-admin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Tipos de dominio
// ---------------------------------------------------------------------------
export type TipoCotizador = 'integrado' | 'externo' | 'pdf' | 'manual'
export type TipoEvento = 'cierre_comisional' | 'cierre_vigencia' | 'pago'
export type EstadoAlta = 'en_proceso' | 'enviada' | 'observada' | 'aprobada' | 'rechazada'

// ---------------------------------------------------------------------------
// PREPAGAS — lectura
// ---------------------------------------------------------------------------

export async function getPrepagas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  let query = supabase
    .from('prepagas')
    .select('*')
    .order('orden', { ascending: true })

  if (!esAdmin) {
    // Asesor: solo las prepagas asignadas
    const { data: asignadas } = await supabase
      .from('prepaga_asesores_safe')
      .select('prepaga_id')
      .eq('asesor_id', user.id)
      .eq('activo', true)
    const ids = (asignadas ?? []).map(a => a.prepaga_id).filter(Boolean) as string[]
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) { console.error('getPrepagas:', error); return [] }
  return data
}

export async function getPrepagaBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prepagas')
    .select(`*, prepaga_planes(*), checklist_plantillas(*, checklist_plantilla_items(*))`)
    .eq('slug', slug)
    .single()
  if (error) return null
  return data
}

export async function getAllPrepagas() {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('prepagas')
    .select('*')
    .order('orden', { ascending: true })
  return data ?? []
}

// ---------------------------------------------------------------------------
// PREPAGAS — admin CRUD
// ---------------------------------------------------------------------------

const PrepagaSchema = z.object({
  nombre: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  cotizador_url: z.string().url().optional().or(z.literal('')),
  tipo_cotizador: z.enum(['integrado', 'externo', 'pdf', 'manual']),
  notas_admin: z.string().optional(),
  orden: z.number().int().default(0),
  activa: z.boolean().default(true),
})

export async function crearPrepaga(formData: z.infer<typeof PrepagaSchema>) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const parsed = PrepagaSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prepagas')
    .insert({ ...parsed.data, cotizador_url: parsed.data.cotizador_url || null })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/prepagas')
  revalidatePath('/admin/prepagas')
  return { data }
}

export async function actualizarPrepaga(id: string, formData: Partial<z.infer<typeof PrepagaSchema>>) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('prepagas')
    .update({ ...formData, cotizador_url: formData.cotizador_url || null })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/prepagas')
  revalidatePath('/admin/prepagas')
  return { success: true }
}

// ---------------------------------------------------------------------------
// PLANES
// ---------------------------------------------------------------------------

export async function getPlanesPorPrepaga(prepagaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prepaga_planes')
    .select('*')
    .eq('prepaga_id', prepagaId)
    .eq('activo', true)
    .order('orden', { ascending: true })
  return data ?? []
}

const PlanSchema = z.object({
  prepaga_id: z.string().uuid(),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  orden: z.number().int().default(0),
})

export async function crearPlan(formData: z.infer<typeof PlanSchema>) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const parsed = PlanSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prepaga_planes')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { data }
}

export async function eliminarPlan(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase.from('prepaga_planes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { success: true }
}

// ---------------------------------------------------------------------------
// ASIGNACIÓN ASESORES
// ---------------------------------------------------------------------------

export async function getAsesoresDePrepaga(prepagaId: string) {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('prepaga_asesores_safe')
    .select('*, profiles(first_name, last_name, email)')
    .eq('prepaga_id', prepagaId)
  return data ?? []
}

export async function asignarAsesor(params: {
  prepaga_id: string
  asesor_id: string
  comision_pct?: number | null
  codigo_productor?: string | null
  credenciales?: { usuario?: string; clave?: string }
}) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('prepaga_asesores')
    .upsert({
      prepaga_id: params.prepaga_id,
      asesor_id: params.asesor_id,
      comision_pct: params.comision_pct ?? null,
      codigo_productor: params.codigo_productor ?? null,
      credenciales: params.credenciales ?? {},
      activo: true,
    }, { onConflict: 'prepaga_id,asesor_id' })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { data }
}

export async function desasignarAsesor(prepagaId: string, asesorId: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('prepaga_asesores')
    .update({ activo: false })
    .eq('prepaga_id', prepagaId)
    .eq('asesor_id', asesorId)

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { success: true }
}

// Route handler helper: obtiene credenciales server-side para inyectar al cotizador
export async function getCredencialesCotizador(prepagaId: string): Promise<{ usuario?: string; clave?: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminSupabase = createAdminClient()
  const { data } = await adminSupabase
    .from('prepaga_asesores')
    .select('credenciales')
    .eq('prepaga_id', prepagaId)
    .eq('asesor_id', user.id)
    .single()

  return (data?.credenciales as { usuario?: string; clave?: string }) ?? null
}

// ---------------------------------------------------------------------------
// EVENTOS (calendario, solo admin)
// ---------------------------------------------------------------------------

export async function getEventosPorMes(mesPeriodo: string) {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('prepaga_eventos')
    .select('*, prepagas(nombre, slug)')
    .eq('mes_periodo', mesPeriodo)
    .order('fecha', { ascending: true })
  return data ?? []
}

const EventoSchema = z.object({
  prepaga_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(['cierre_comisional', 'cierre_vigencia', 'pago']),
  segmento: z.string().optional(),
  nota: z.string().optional(),
  mes_periodo: z.string().regex(/^\d{4}-\d{2}$/),
})

export async function crearEvento(formData: z.infer<typeof EventoSchema>) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const parsed = EventoSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('prepaga_eventos')
    .insert({ ...parsed.data, created_by: user!.id })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas/calendarios')
  return { data }
}

export async function eliminarEvento(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase.from('prepaga_eventos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas/calendarios')
  return { success: true }
}

// ---------------------------------------------------------------------------
// CHECKLIST PLANTILLAS (admin)
// ---------------------------------------------------------------------------

export async function getPlantillasDePrepaga(prepagaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('checklist_plantillas')
    .select('*, checklist_plantilla_items(*)')
    .eq('prepaga_id', prepagaId)
    .eq('activa', true)
    .order('nombre')
  return data ?? []
}

export async function agregarItemPlantilla(params: {
  plantilla_id: string
  etiqueta: string
  tipo_dato: 'check' | 'texto' | 'archivo' | 'fecha' | 'numero'
  requerido: boolean
  orden: number
}) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_plantilla_items')
    .insert(params)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { data }
}

export async function eliminarItemPlantilla(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase.from('checklist_plantilla_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { success: true }
}

// ---------------------------------------------------------------------------
// ALTAS
// ---------------------------------------------------------------------------

export async function getAltas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  let query = supabase
    .from('altas')
    .select(`
      *,
      prepagas(nombre, slug),
      prepaga_planes(nombre),
      leads(first_name, last_name, phone),
      profiles!altas_asesor_id_fkey(first_name, last_name),
      alta_items(id, requerido, completado)
    `)
    .order('created_at', { ascending: false })

  if (!esAdmin) {
    query = query.eq('asesor_id', user.id)
  }

  const { data, error } = await query
  if (error) { console.error('getAltas:', error); return [] }
  return data
}

export async function getAltaById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('altas')
    .select(`
      *,
      prepagas(nombre, slug, cotizador_url),
      prepaga_planes(nombre),
      leads(first_name, last_name, phone, cuil, edades, cantidad_integrantes),
      profiles!altas_asesor_id_fkey(first_name, last_name),
      alta_items(*)
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

const IniciarAltaSchema = z.object({
  lead_id: z.string().uuid(),
  prepaga_id: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
  tipo_alta: z.string().optional(),
})

export async function iniciarAlta(formData: z.infer<typeof IniciarAltaSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = IniciarAltaSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Buscar plantilla activa para esta prepaga (y tipo_alta si se especificó)
  let plantillaQuery = supabase
    .from('checklist_plantillas')
    .select('id, checklist_plantilla_items(*)')
    .eq('prepaga_id', parsed.data.prepaga_id)
    .eq('activa', true)

  if (parsed.data.tipo_alta) {
    plantillaQuery = plantillaQuery.eq('tipo_alta', parsed.data.tipo_alta)
  } else {
    plantillaQuery = plantillaQuery.is('tipo_alta', null)
  }

  const { data: plantillas } = await plantillaQuery.limit(1)
  const plantilla = plantillas?.[0]

  // Crear el alta
  const { data: alta, error: altaError } = await supabase
    .from('altas')
    .insert({
      lead_id: parsed.data.lead_id,
      prepaga_id: parsed.data.prepaga_id,
      plan_id: parsed.data.plan_id ?? null,
      asesor_id: user.id,
      plantilla_id: plantilla?.id ?? null,
      tipo_alta: parsed.data.tipo_alta ?? null,
      estado: 'en_proceso',
    })
    .select()
    .single()

  if (altaError) return { error: altaError.message }

  // Copiar ítems de la plantilla (snapshot)
  if (plantilla?.checklist_plantilla_items?.length) {
    const items = plantilla.checklist_plantilla_items.map((item: {
      id: string; etiqueta: string; tipo_dato: string; requerido: boolean
    }) => ({
      alta_id: alta.id,
      plantilla_item_id: item.id,
      etiqueta: item.etiqueta,
      tipo_dato: item.tipo_dato,
      requerido: item.requerido,
    }))
    await supabase.from('alta_items').insert(items)
  }

  // Registrar actividad en el lead
  await supabase.from('activities').insert({
    lead_id: parsed.data.lead_id,
    created_by: user.id,
    type: 'alta_iniciada',
    description: `Alta iniciada en prepaga`,
  })

  revalidatePath('/altas')
  revalidatePath(`/leads/${parsed.data.lead_id}`)
  return { data: alta }
}

export async function actualizarEstadoAlta(id: string, estado: EstadoAlta, observaciones?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const updateData: Record<string, unknown> = { estado }
  if (observaciones) updateData.observaciones = observaciones
  if (estado === 'enviada') updateData.enviada_at = new Date().toISOString()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  let query = supabase.from('altas').update(updateData).eq('id', id)
  if (!esAdmin) query = query.eq('asesor_id', user.id)

  const { error } = await query
  if (error) return { error: error.message }

  revalidatePath('/altas')
  revalidatePath(`/altas/${id}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// ALTA ITEMS — completar checklist
// ---------------------------------------------------------------------------

export async function completarItem(params: {
  item_id: string
  completado: boolean
  valor_texto?: string
  valor_fecha?: string
  valor_numero?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('alta_items')
    .update({
      completado: params.completado,
      valor_texto: params.valor_texto ?? null,
      valor_fecha: params.valor_fecha ?? null,
      valor_numero: params.valor_numero ?? null,
      completado_by: params.completado ? user.id : null,
      completado_at: params.completado ? new Date().toISOString() : null,
    })
    .eq('id', params.item_id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function subirAdjunto(params: {
  alta_id: string
  item_id: string
  archivo_path: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('alta_items')
    .update({
      completado: true,
      archivo_path: params.archivo_path,
      completado_by: user.id,
      completado_at: new Date().toISOString(),
    })
    .eq('id', params.item_id)
    .eq('alta_id', params.alta_id)

  if (error) return { error: error.message }
  revalidatePath(`/altas/${params.alta_id}`)
  return { success: true }
}
