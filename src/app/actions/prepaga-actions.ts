'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, isAdminRole } from '@/lib/supabase/assert-admin'
import type { TablesInsert } from '@/lib/supabase/types'
import {
  listarContenidoCarpeta,
  crearCarpetaDrive,
  subirArchivoDrive,
  guardarDocResumen,
  type DriveItem,
} from '@/lib/google-drive'
import { generarResumenTexto, type ResumenIntegrante, type DatoItem } from '@/lib/alta-resumen'
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

// ---------------------------------------------------------------------------
// RECURSOS DE DRIVE POR PREPAGA
// ---------------------------------------------------------------------------

export type RecursosPrepaga = {
  folderId: string | null
  items: DriveItem[]
  error?: string
}

// Devuelve el listado inicial de la carpeta de Drive de una prepaga.
// Valida que el usuario tenga acceso a la prepaga (asignada, o admin).
export async function getRecursosPrepaga(prepagaId: string): Promise<RecursosPrepaga> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { folderId: null, items: [], error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  // Asesor: solo prepagas asignadas y activas
  if (!isAdminRole(profile?.role)) {
    const { data: asignada } = await supabase
      .from('prepaga_asesores_safe')
      .select('prepaga_id')
      .eq('asesor_id', user.id)
      .eq('prepaga_id', prepagaId)
      .eq('activo', true)
      .maybeSingle()
    if (!asignada) return { folderId: null, items: [], error: 'No tenés esta prepaga asignada' }
  }

  const { data: prepaga } = await supabase
    .from('prepagas')
    .select('drive_folder_id')
    .eq('id', prepagaId)
    .single()

  const folderId = prepaga?.drive_folder_id ?? null
  if (!folderId) return { folderId: null, items: [] }

  try {
    const items = await listarContenidoCarpeta(folderId)
    return { folderId, items }
  } catch {
    return { folderId, items: [], error: 'No se pudo conectar con Google Drive' }
  }
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
  seccion?: 'documentos' | 'datos'
}) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_plantilla_items')
    .insert({ ...params, seccion: params.seccion ?? 'documentos' })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { data }
}

export async function actualizarResumenTemplate(plantillaId: string, template: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('checklist_plantillas') as any)
    .update({ resumen_template: template || null })
    .eq('id', plantillaId)

  if (error) return { error: error.message }
  revalidatePath('/admin/prepagas')
  return { success: true }
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

  const query = supabase
    .from('altas')
    .select(`
      *,
      prepagas(nombre, slug),
      prepaga_planes(nombre),
      leads(first_name, last_name, phone),
      profiles!altas_asesor_id_fkey(first_name, last_name),
      alta_items(id, requerido, completado, momento)
    `)
    .order('created_at', { ascending: false })

  // Sin filtro por usuario: el alcance lo resuelve el RLS de `altas`
  // (auth_is_admin() OR asesor_id in auth_asesores_visibles()). Filtrar acá
  // además duplicaba la definición de visibilidad, y la copia del código se
  // había quedado atrás: un líder veía 0 altas cuando la base le permitía
  // ver las de su equipo.
  const { data, error } = await query
  if (error) { console.error('getAltas:', error); return [] }
  return data
}

// ---------------------------------------------------------------------------
// TABLERO DE ALTAS — vista agrupada por líder y asesor, con selector de alcance
// ---------------------------------------------------------------------------

export type AltaTableroRow = {
  id: string
  estado: string
  created_at: string
  enviada_at: string | null
  cuota: number | null
  asesor_id: string
  asesor_nombre: string
  lider_id: string | null
  lider_nombre: string | null
  lead_nombre: string
  prepaga_nombre: string
  plan_nombre: string | null
  requeridos: number
  completados: number
}

export type AltasTablero = {
  rows: AltaTableroRow[]
  userId: string
  // Los asesores a cargo salen de la RELACIÓN (admin_asesores), no del rol.
  // Es lo que permite que alguien admin, líder y vendedor a la vez tenga las
  // tres vistas disponibles sin ninguna rama especial por rol.
  misAsesoresIds: string[]
}

const nombreCompleto = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()

// Compone lo que necesita el tablero en una sola pasada: las altas que el RLS
// deja ver, más el líder de cada vendedor para poder agrupar.
//
// `admin_asesores` tiene el mismo alcance de RLS que `altas` (admin ve todo,
// el líder ve su equipo, el asesor ve su fila), así que el agrupamiento nunca
// puede revelar una relación que el usuario no tenga derecho a ver: en el peor
// caso un alta queda sin líder conocido y cae en "Sin equipo asignado".
export async function getAltasTablero(): Promise<AltasTablero> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], userId: '', misAsesoresIds: [] }

  const [altas, { data: relaciones }] = await Promise.all([
    getAltas(),
    supabase
      .from('admin_asesores')
      .select('admin_id, asesor_id, profiles!admin_asesores_admin_id_fkey(first_name, last_name)'),
  ])

  type Relacion = {
    admin_id: string
    asesor_id: string
    profiles: { first_name: string | null; last_name: string | null } | null
  }

  const lider = new Map<string, { id: string; nombre: string }>()
  for (const r of (relaciones ?? []) as unknown as Relacion[]) {
    lider.set(r.asesor_id, {
      id: r.admin_id,
      nombre: nombreCompleto(r.profiles) || 'Líder sin nombre',
    })
  }

  const misAsesoresIds = ((relaciones ?? []) as unknown as Relacion[])
    .filter(r => r.admin_id === user.id)
    .map(r => r.asesor_id)

  type AltaCruda = {
    id: string
    estado: string
    created_at: string
    enviada_at: string | null
    cuota: number | null
    asesor_id: string
    leads: { first_name: string | null; last_name: string | null } | null
    prepagas: { nombre: string } | null
    prepaga_planes: { nombre: string } | null
    profiles: { first_name: string | null; last_name: string | null } | null
    alta_items: { requerido: boolean; completado: boolean; momento: string }[] | null
  }

  const rows: AltaTableroRow[] = (altas as unknown as AltaCruda[]).map(a => {
    const items = a.alta_items ?? []
    const itemsEnvio = items.filter(i => (i.momento ?? 'envio') === 'envio')
    const jefe = lider.get(a.asesor_id) ?? null

    return {
      id: a.id,
      estado: a.estado,
      created_at: a.created_at,
      enviada_at: a.enviada_at,
      cuota: a.cuota === null ? null : Number(a.cuota),
      asesor_id: a.asesor_id,
      asesor_nombre: nombreCompleto(a.profiles) || 'Sin asesor',
      lider_id: jefe?.id ?? null,
      lider_nombre: jefe?.nombre ?? null,
      lead_nombre: nombreCompleto(a.leads) || 'Sin nombre',
      prepaga_nombre: a.prepagas?.nombre ?? '—',
      plan_nombre: a.prepaga_planes?.nombre ?? null,
      // Solo los ítems del envío. Contar también los post-aprobación dejaría un
      // trámite listo para mandar mostrándose 5/6 en el tablero, y no habría
      // forma de completarlo antes de que el admin lo apruebe.
      requeridos: itemsEnvio.filter(i => i.requerido).length,
      completados: itemsEnvio.filter(i => i.requerido && i.completado).length,
    }
  })

  return { rows, userId: user.id, misAsesoresIds }
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
  // Opcional: si no viene, iniciarAlta() busca la cotización aprobada más
  // reciente del lead para esa prepaga. Es el origen del prefill.
  cotizacion_id: z.string().uuid().optional(),
})

// Normaliza una etiqueta de ítem a la misma clave que usa el motor de resumen
// (alta-resumen.ts), para poder mapear datos del lead a ítems de la plantilla.
function claveEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export async function iniciarAlta(formData: z.infer<typeof IniciarAltaSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = IniciarAltaSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Buscar plantilla activa: primero la específica por tipo_alta, luego la genérica.
  // Esto permite tener plantillas distintas por tipo de contratación (particular,
  // relacion_dependencia, etc.) con un fallback genérico (tipo_alta IS NULL).
  let plantilla = null

  if (parsed.data.tipo_alta) {
    const { data } = await supabase
      .from('checklist_plantillas')
      .select('id, checklist_plantilla_items(*)')
      .eq('prepaga_id', parsed.data.prepaga_id)
      .eq('tipo_alta', parsed.data.tipo_alta)
      .eq('activa', true)
      .limit(1)
      .maybeSingle()
    plantilla = data
  }

  if (!plantilla) {
    const { data } = await supabase
      .from('checklist_plantillas')
      .select('id, checklist_plantilla_items(*)')
      .eq('prepaga_id', parsed.data.prepaga_id)
      .is('tipo_alta', null)
      .eq('activa', true)
      .limit(1)
      .maybeSingle()
    plantilla = data
  }

  // Cotización de origen. El alta nace de una cotización: sin este vínculo el
  // asesor re-tipea plan, cuota y grupo familiar que ya cargó en el cotizador,
  // y después no hay forma de responder "con qué números se vendió esto".
  type CotizacionOrigen = {
    id: string
    plan_id: string | null
    valor_final: number | null
    valor_calculado: number | null
    integrantes: unknown
  }
  let cotizacion: CotizacionOrigen | null = null

  if (parsed.data.cotizacion_id) {
    const { data } = await supabase
      .from('lead_cotizaciones')
      .select('id, plan_id, valor_final, valor_calculado, integrantes')
      .eq('id', parsed.data.cotizacion_id)
      .eq('lead_id', parsed.data.lead_id)
      .maybeSingle()
    cotizacion = data as CotizacionOrigen | null
  } else {
    const { data } = await supabase
      .from('lead_cotizaciones')
      .select('id, plan_id, valor_final, valor_calculado, integrantes')
      .eq('lead_id', parsed.data.lead_id)
      .eq('prepaga_id', parsed.data.prepaga_id)
      .eq('estado', 'aprobada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    cotizacion = data as CotizacionOrigen | null
  }

  const integrantesCotizacion = Array.isArray(cotizacion?.integrantes)
    ? (cotizacion!.integrantes as { rol?: string; edad?: number }[])
    : []

  // La cuota solo se arrastra si es un número positivo. Ya pasó que el
  // cotizador externo de Sancor guardara el SUBTOTAL (negativo) como
  // valor_final: propagar eso al alta sería propagarlo a la comisión.
  const cuotaCotizada =
    cotizacion?.valor_final != null && cotizacion.valor_final > 0
      ? cotizacion.valor_final
      : null

  // Crear el alta
  const { data: alta, error: altaError } = await supabase
    .from('altas')
    .insert({
      lead_id: parsed.data.lead_id,
      prepaga_id: parsed.data.prepaga_id,
      plan_id: parsed.data.plan_id ?? cotizacion?.plan_id ?? null,
      asesor_id: user.id,
      plantilla_id: plantilla?.id ?? null,
      tipo_alta: parsed.data.tipo_alta ?? null,
      estado: 'en_proceso',
      cotizacion_id: cotizacion?.id ?? null,
      cuota: cuotaCotizada,
      cantidad_capitas: integrantesCotizacion.length || null,
    })
    .select()
    .single()

  if (altaError) return { error: altaError.message }

  // Copiar ítems de la plantilla (snapshot — incluye sección para filtrado en UI)
  if (plantilla?.checklist_plantilla_items?.length) {
    const items = plantilla.checklist_plantilla_items.map((item: {
      id: string; etiqueta: string; tipo_dato: string; requerido: boolean; seccion?: string; momento?: string
    }) => ({
      alta_id: alta.id,
      plantilla_item_id: item.id,
      etiqueta: item.etiqueta,
      tipo_dato: item.tipo_dato,
      requerido: item.requerido,
      seccion: item.seccion ?? 'documentos',
      // `momento` decide si el ítem vence en el envío o después de la
      // aprobación. Sin este snapshot, cambiar la plantilla mañana movería de
      // etapa documentos de trámites ya en curso.
      momento: item.momento ?? 'envio',
    }))
    await supabase.from('alta_items').insert(items)
  }

  // Prefill del grupo familiar. Antes se creaba solo el titular con
  // nombre/cuil/teléfono; todo lo demás lo re-tipeaba el asesor aunque el lead
  // y la cotización ya lo tuvieran.
  const { data: leadInfo } = await supabase
    .from('leads')
    .select('first_name, last_name, phone, cuil, dni, email, sueldo_bruto, cuit_empleador, address_city, address_state')
    .eq('id', parsed.data.lead_id)
    .single()

  const domicilioLead =
    [leadInfo?.address_city, leadInfo?.address_state].filter(Boolean).join(', ') || null

  // El titular es siempre la fila 0. Del resto de las cápitas de la cotización
  // solo conocemos rol y edad: se crean vacías para que el asesor complete
  // DNI/CUIL, pero al menos la cantidad de integrantes ya queda bien.
  type IntegranteInsert = {
    alta_id: string
    rol: string
    orden: number
    nombre?: string | null
    dni?: string | null
    cuil?: string | null
    edad?: number | null
    telefono?: string | null
    email?: string | null
    domicilio?: string | null
  }

  const filasIntegrantes: IntegranteInsert[] = [{
    alta_id: alta.id,
    rol: 'titular',
    orden: 0,
    nombre: [leadInfo?.first_name, leadInfo?.last_name].filter(Boolean).join(' ') || null,
    dni: leadInfo?.dni ?? null,
    cuil: leadInfo?.cuil ?? null,
    edad: integrantesCotizacion[0]?.edad ?? null,
    telefono: leadInfo?.phone ?? null,
    email: leadInfo?.email ?? null,
    domicilio: domicilioLead,
  }]

  integrantesCotizacion.slice(1).forEach((integ, idx) => {
    filasIntegrantes.push({
      alta_id: alta.id,
      rol: integ.rol && integ.rol !== 'titular' ? integ.rol : 'adherente',
      orden: idx + 1,
      edad: integ.edad ?? null,
    })
  })

  await supabase.from('alta_integrantes').insert(filasIntegrantes)

  // Sueldo bruto: dato comercial del alta que el lead ya podía traer.
  if (leadInfo?.sueldo_bruto != null) {
    await supabase.from('altas').update({ sueldo_bruto: leadInfo.sueldo_bruto }).eq('id', alta.id)
  }

  // Prefill de los ítems de sección `datos` que el lead ya puede responder.
  // Best-effort y por etiqueta: si mañana se renombra un ítem en la plantilla,
  // deja de prefillear (queda vacío para que lo cargue el asesor), no rompe.
  const PREFILL_DATOS: Record<string, string | null | undefined> = {
    cuit_empleador: leadInfo?.cuit_empleador,
    provincia: leadInfo?.address_state,
    localidad: leadInfo?.address_city,
  }

  const { data: itemsDatos } = await supabase
    .from('alta_items')
    .select('id, etiqueta')
    .eq('alta_id', alta.id)
    .eq('seccion', 'datos')

  for (const item of itemsDatos ?? []) {
    const valor = PREFILL_DATOS[claveEtiqueta(item.etiqueta)]
    if (!valor) continue
    await supabase
      .from('alta_items')
      .update({ valor_texto: valor, completado: true, completado_by: user.id, completado_at: new Date().toISOString() })
      .eq('id', item.id)
  }

  // Crear la carpeta del trámite en Drive (best-effort: si falla, el alta igual
  // se crea y se puede reintentar con crearCarpetaAlta).
  try {
    const { data: prepaga } = await supabase
      .from('prepagas')
      .select('drive_folder_id')
      .eq('id', parsed.data.prepaga_id)
      .single()

    if (prepaga?.drive_folder_id) {
      const nombreCarpeta = nombreCarpetaAlta(
        leadInfo?.first_name,
        leadInfo?.last_name,
        alta.id
      )
      const carpeta = await crearCarpetaDrive(prepaga.drive_folder_id, nombreCarpeta)
      await supabase
        .from('altas')
        .update({ drive_folder_id: carpeta.id, drive_folder_url: carpeta.urlVista })
        .eq('id', alta.id)
      alta.drive_folder_id = carpeta.id
      alta.drive_folder_url = carpeta.urlVista
    }
  } catch (error) {
    console.error('[Alta] No se pudo crear la carpeta de Drive:', error)
  }

  // Registrar actividad. `alta_id` permite reconstruir el historial de ESTE
  // trámite: sin él, dos altas del mismo lead (por ejemplo un reintento con
  // otra prepaga tras un rechazo) quedan mezcladas en el mismo timeline.
  await supabase.from('activities').insert({
    lead_id: parsed.data.lead_id,
    alta_id: alta.id,
    created_by: user.id,
    type: 'alta_iniciada',
    description: cotizacion
      ? 'Alta iniciada desde cotización aprobada'
      : 'Alta iniciada sin cotización de origen',
  })

  revalidatePath('/altas')
  revalidatePath(`/leads/${parsed.data.lead_id}`)
  return { data: alta }
}

// Nombre de la carpeta del trámite: "Apellido Nombre - AAAA-MM-DD".
// Si no hay nombre, usa el id corto del alta como fallback.
function nombreCarpetaAlta(
  firstName?: string | null,
  lastName?: string | null,
  altaId?: string
): string {
  const fecha = new Date().toISOString().slice(0, 10)
  const partes = [lastName, firstName].filter(Boolean).join(' ').trim()
  const base = partes || `Alta ${altaId?.slice(0, 8) ?? ''}`.trim()
  // Sanitizar caracteres problemáticos para nombres de carpeta
  const limpio = base.replace(/[\\/:*?"<>|]/g, '').trim()
  return `${limpio} - ${fecha}`
}

// (Re)crea la carpeta de Drive de un alta que no la tenga (o falló al iniciar).
export async function crearCarpetaAlta(altaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: alta } = await supabase
    .from('altas')
    .select('id, prepaga_id, drive_folder_id, leads(first_name, last_name)')
    .eq('id', altaId)
    .single()
  if (!alta) return { error: 'Alta no encontrada' }
  if (alta.drive_folder_id) return { error: 'La carpeta ya existe' }

  const { data: prepaga } = await supabase
    .from('prepagas')
    .select('drive_folder_id')
    .eq('id', alta.prepaga_id)
    .single()
  if (!prepaga?.drive_folder_id) {
    return { error: 'La prepaga no tiene carpeta de Drive configurada' }
  }

  const lead = alta.leads as { first_name: string; last_name: string | null } | null
  try {
    const nombreCarpeta = nombreCarpetaAlta(lead?.first_name, lead?.last_name, alta.id)
    const carpeta = await crearCarpetaDrive(prepaga.drive_folder_id, nombreCarpeta)
    await supabase
      .from('altas')
      .update({ drive_folder_id: carpeta.id, drive_folder_url: carpeta.urlVista })
      .eq('id', altaId)
    revalidatePath(`/altas/${altaId}`)
    return { data: carpeta }
  } catch (error) {
    console.error('[Alta] Error creando carpeta:', error)
    return { error: 'No se pudo crear la carpeta en Drive' }
  }
}

// Qué le falta a un alta para poder enviarse a procesar.
// Espejo en TypeScript del trigger `altas_guard_estado` (migración
// 20260827_altas_guard_estado.sql). La base es la que manda —esto existe para
// poder MOSTRAR la lista antes de que el asesor apriete el botón, en vez de
// devolverle una excepción de Postgres.
export async function getFaltantesAlta(altaId: string): Promise<string[]> {
  const supabase = await createClient()
  const faltantes: string[] = []

  const { data: alta } = await supabase
    .from('altas')
    .select('tipo_alta, cuota')
    .eq('id', altaId)
    .single()
  if (!alta) return ['Alta no encontrada']

  if (!alta.tipo_alta) faltantes.push('Tipo de alta (define la escala comisional)')
  if (alta.cuota == null || alta.cuota <= 0) faltantes.push('Cuota del trámite')

  // Solo los ítems del momento 'envio'. Los post-aprobación (por ejemplo la
  // constancia de derivación de aportes) todavía no existen cuando el trámite
  // se manda: exigirlos acá bloquearía el envío para siempre.
  const { data: items } = await supabase
    .from('alta_items')
    .select('etiqueta, seccion')
    .eq('alta_id', altaId)
    .eq('requerido', true)
    .eq('completado', false)
    .eq('momento', 'envio')

  for (const item of items ?? []) {
    faltantes.push(item.seccion === 'datos' ? `Dato: ${item.etiqueta}` : `Documento: ${item.etiqueta}`)
  }

  const { data: titular } = await supabase
    .from('alta_integrantes')
    .select('dni, cuil')
    .eq('alta_id', altaId)
    .eq('rol', 'titular')
    .maybeSingle()

  if (!titular || (!titular.dni && !titular.cuil)) {
    faltantes.push('DNI o CUIL del titular')
  }

  return faltantes
}

// Qué le falta a un alta ya aprobada para poder pasar a liquidación.
// Espejo del trigger `comisiones_guard_post_aprobacion`.
export async function getFaltantesLiquidacion(altaId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('alta_items')
    .select('etiqueta')
    .eq('alta_id', altaId)
    .eq('requerido', true)
    .eq('completado', false)
    .eq('momento', 'post_aprobacion')
  return (items ?? []).map(i => i.etiqueta)
}

export async function actualizarEstadoAlta(id: string, estado: EstadoAlta, observaciones?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  // Aprobar o rechazar una venta es una decisión del admin, no del asesor que la vendió.
  if ((estado === 'aprobada' || estado === 'rechazada') && !esAdmin) {
    return { error: 'Solo un administrador puede aprobar o rechazar una venta' }
  }

  const { data: altaPrevia } = await supabase
    .from('altas')
    .select('estado, lead_id, prepaga_id, asesor_id, tipo_alta')
    .eq('id', id)
    .single()
  if (!altaPrevia) return { error: 'Alta no encontrada' }

  // Enviar a procesar deja de ser "marcar una opción": el trámite tiene que
  // estar completo. El trigger de la base rechaza igual si esto se saltea; acá
  // lo chequeamos antes para devolver una lista legible en vez de un error de
  // Postgres. El admin puede forzar (mismo criterio que el trigger).
  if (estado === 'enviada' && !esAdmin) {
    const faltantes = await getFaltantesAlta(id)
    if (faltantes.length > 0) {
      return {
        error: `No se puede enviar a procesar. Falta: ${faltantes.slice(0, 4).join(', ')}` +
          (faltantes.length > 4 ? ` y ${faltantes.length - 4} más` : ''),
      }
    }
  }

  const updateData: Record<string, unknown> = { estado }
  if (observaciones) updateData.observaciones = observaciones
  if (estado === 'enviada') updateData.enviada_at = new Date().toISOString()

  let query = supabase.from('altas').update(updateData).eq('id', id)
  if (!esAdmin) query = query.eq('asesor_id', user.id)

  const { error } = await query
  if (error) return { error: error.message }

  // Trazabilidad: todo cambio de estado del alta queda en el historial del lead.
  const ESTADO_LABELS: Record<string, string> = {
    en_proceso: 'En proceso', enviada: 'Enviada', observada: 'Observada',
    aprobada: 'Aprobada', rechazada: 'Rechazada',
  }
  await supabase.from('activities').insert({
    lead_id: altaPrevia.lead_id,
    alta_id: id,
    created_by: user.id,
    type: 'alta_estado_cambio',
    description: `Alta: ${ESTADO_LABELS[altaPrevia.estado] ?? altaPrevia.estado} → ${ESTADO_LABELS[estado] ?? estado}${observaciones ? ` (${observaciones})` : ''}`,
  })

  // Venta aprobada por el admin: dispara el cálculo automático de comisión.
  if (estado === 'aprobada') {
    // Sin fallback a 'particular'. Ese default silencioso liquidaba cualquier
    // alta sin tipo con la escala de particular: en Premedic y DoctoRed, un PMO
    // que debía pagarse al 7,65% / 7,038% del sueldo bruto se liquidaba al 100%
    // del valor del plan. Mejor no generar la comisión y que quede el registro,
    // a generarla mal y que nadie se entere.
    if (!altaPrevia.tipo_alta) {
      await supabase.from('activities').insert({
        lead_id: altaPrevia.lead_id,
        alta_id: id,
        created_by: user.id,
        type: 'comision_sin_regla',
        description: 'No se generó comisión: el alta no tiene tipo (particular / relación de dependencia / monotributo / PMO). Cargalo y volvé a aprobar.',
      })
    } else {
      // La aprobación ya no devenga sola. En un desregulado de relación de
      // dependencia la constancia de derivación de aportes recién se consigue
      // después de aprobada: la comisión nace cuando el papel está y un admin
      // pasa el trámite a liquidación (pasarALiquidacion).
      const pendientes = await getFaltantesLiquidacion(id)
      if (pendientes.length > 0) {
        await supabase.from('activities').insert({
          lead_id: altaPrevia.lead_id,
          alta_id: id,
          created_by: user.id,
          type: 'comision_pendiente_documentacion',
          description: `Alta aprobada. La comisión se genera al pasar a liquidación, cuando se adjunte: ${pendientes.join(', ')}.`,
        })
      } else {
        await generarComisionParaAlta({
          altaId: id,
          leadId: altaPrevia.lead_id,
          prepagaId: altaPrevia.prepaga_id,
          asesorId: altaPrevia.asesor_id,
          segmento: altaPrevia.tipo_alta,
        })
      }
    }
  }

  revalidatePath('/altas')
  revalidatePath(`/altas/${id}`)
  revalidatePath(`/leads/${altaPrevia.lead_id}`)
  revalidatePath('/comisiones')
  revalidatePath('/admin/comisiones')
  return { success: true }
}

// Pase explícito a liquidación de un alta ya aprobada.
// Es la acción que devenga la comisión. Adjuntar el documento puede hacerlo
// cualquiera de los dos, pero habilitar la plata es del admin: si el pase fuera
// automático al subir el archivo, el asesor decidiría solo cuándo se le liquida.
export async function pasarALiquidacion(altaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) {
    return { error: 'Solo un administrador puede pasar un alta a liquidación' }
  }

  const { data: alta } = await supabase
    .from('altas')
    .select('id, estado, lead_id, prepaga_id, asesor_id, tipo_alta')
    .eq('id', altaId)
    .single()
  if (!alta) return { error: 'Alta no encontrada' }
  if (alta.estado !== 'aprobada') {
    return { error: 'El alta tiene que estar aprobada para pasar a liquidación' }
  }
  if (!alta.tipo_alta) {
    return { error: 'Falta el tipo de alta: define la escala comisional' }
  }

  const pendientes = await getFaltantesLiquidacion(altaId)
  if (pendientes.length > 0) {
    return { error: `Falta adjuntar: ${pendientes.join(', ')}` }
  }

  // Idempotente: si la comisión ya existe no vuelve a generarla.
  await generarComisionParaAlta({
    altaId,
    leadId: alta.lead_id,
    prepagaId: alta.prepaga_id,
    asesorId: alta.asesor_id,
    segmento: alta.tipo_alta,
  })

  // generarComisionParaAlta() no lanza: cuando falta la regla comisional o el
  // monto base, deja una actividad y vuelve sin insertar nada. Sin este chequeo
  // el admin vería "pasó a liquidación" con cero comisiones generadas.
  const { data: comisiones } = await supabase
    .from('comisiones').select('id').eq('alta_id', altaId).limit(1)
  if (!comisiones || comisiones.length === 0) {
    return {
      error: 'No se generó la comisión. Revisá el historial del lead: probablemente falte la regla comisional de la prepaga o el % del asesor.',
    }
  }

  await supabase.from('activities').insert({
    lead_id: alta.lead_id,
    alta_id: altaId,
    created_by: user.id,
    type: 'alta_a_liquidacion',
    description: 'Documentación posterior a la aprobación completa: el trámite pasó a liquidación.',
  })

  revalidatePath(`/altas/${altaId}`)
  revalidatePath('/comisiones')
  revalidatePath('/admin/comisiones')
  return { success: true }
}

// ---------------------------------------------------------------------------
// COMISIONES
// ---------------------------------------------------------------------------

// Devuelve el lote abierto de la prepaga; si no existe, lo crea para el mes actual.
// Toda comisión nace dentro de un lote para que la liquidación sea trazable por cierre.
async function getOrCreateCierreAbierto(supabase: Awaited<ReturnType<typeof createClient>>, prepagaId: string) {
  const { data: abierto } = await supabase
    .from('cierres_comisionales')
    .select('id, mes_periodo')
    .eq('prepaga_id', prepagaId)
    .eq('estado', 'abierto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (abierto) return abierto

  const mesPeriodo = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { data: nuevo } = await supabase
    .from('cierres_comisionales')
    .insert({ prepaga_id: prepagaId, mes_periodo: mesPeriodo })
    .select('id, mes_periodo')
    .single()
  return nuevo
}

async function generarComisionParaAlta(params: {
  altaId: string
  leadId: string
  prepagaId: string
  asesorId: string
  segmento: string
}) {
  const supabase = await createClient()

  // Evitar duplicados si por algún motivo se vuelve a aprobar.
  // OJO: ya no es 1:1 con el alta —una venta genera la directa más los
  // overrides—, así que .maybeSingle() acá tiraba error apenas existiera más
  // de una fila. Se chequea por existencia, no por unicidad.
  const { data: existentes } = await supabase
    .from('comisiones').select('id').eq('alta_id', params.altaId).limit(1)
  if (existentes && existentes.length > 0) return

  const { data: lead } = await supabase
    .from('leads')
    .select('valor_final_socio, sueldo_bruto, origen')
    .eq('id', params.leadId)
    .single()

  // Los importes del ALTA mandan sobre los del lead. El lead trae lo cotizado,
  // que es una etapa previa y puede haber quedado vieja: se renegoció, cambió
  // el descuento, se dio de alta un plan distinto. El alta tiene el número con
  // el que la venta se emitió de verdad.
  //
  // Antes se liquidaba siempre contra el lead, así que un asesor podía cargar
  // la cuota correcta en el alta y ver la comisión calculada sobre otra cifra,
  // sin ninguna señal de que eso estaba pasando.
  const { data: altaDatos } = await supabase
    .from('altas')
    .select('cuota, sueldo_bruto')
    .eq('id', params.altaId)
    .single()

  const origen = lead?.origen ?? 'nexo'

  // La escala depende del origen del dato: regla específica del origen primero,
  // si no existe cae a la regla general (origen NULL, aplica a todos).
  const { data: reglas } = await supabase
    .from('prepaga_comision_reglas')
    .select('*')
    .eq('prepaga_id', params.prepagaId)
    .eq('segmento', params.segmento)
    .or(`origen.eq.${origen},origen.is.null`)

  const regla = reglas?.find(r => r.origen === origen) ?? reglas?.find(r => r.origen === null)

  if (!regla) {
    await supabase.from('activities').insert({
      lead_id: params.leadId,
      created_by: params.asesorId,
      type: 'comision_sin_regla',
      description: `No se generó comisión: no hay regla configurada para este segmento (${params.segmento}) y origen (${origen}) en esta prepaga`,
    })
    return
  }

  const montoBase = regla.tipo_base === 'pct_sueldo_bruto'
    ? (altaDatos?.sueldo_bruto ?? lead?.sueldo_bruto)
    : (altaDatos?.cuota ?? lead?.valor_final_socio)

  if (montoBase === null || montoBase === undefined) {
    const campoFaltante = regla.tipo_base === 'pct_sueldo_bruto' ? 'sueldo bruto' : 'cuota mensual'
    await supabase.from('activities').insert({
      lead_id: params.leadId,
      created_by: params.asesorId,
      type: 'comision_sin_regla',
      description: `No se pudo calcular la comisión: falta el dato "${campoFaltante}". Cargalo en los datos del trámite del alta y volvé a aprobar.`,
    })
    return
  }

  // ---------------------------------------------------------------------------
  // MODELO DE CÁLCULO
  //
  // Todos los porcentajes se expresan en la MISMA unidad: % de la cuota.
  // Son escalas independientes, no se multiplican entre sí.
  //
  //   facturación NEXO  = cuota × regla.porcentaje   (ej. 260% → 130.000)
  //   pago al asesor    = cuota × comision_pct       (ej. 180% →  90.000)
  //   override líder    = cuota × pct_equipo
  //   margen NEXO       = facturación − suma de todos los pagos de esa venta
  //
  // La versión anterior MULTIPLICABA los dos porcentajes, lo que solo tiene
  // sentido si el del asesor es una porción del de la agencia. Con ambos sobre
  // la cuota, multiplicar da cualquier cosa: 50.000 × 2,6 × 1,8 = 234.000.
  //
  // La facturación no se guarda aparte: la fila `directa` ya lleva `monto_base`
  // y `porcentaje` (el de la prepaga), así que sale de ahí.
  // ---------------------------------------------------------------------------
  const adminSupabase = createAdminClient()
  const { data: asignacion } = await adminSupabase
    .from('prepaga_asesores')
    .select('comision_pct')
    .eq('prepaga_id', params.prepagaId)
    .eq('asesor_id', params.asesorId)
    .maybeSingle()
  const pctAsesor = asignacion?.comision_pct ?? null

  // Sin porcentaje cargado no se puede saber cuánto cobra el asesor. Antes el
  // NULL se trataba como "×1", que con el modelo viejo significaba llevarse
  // toda la comisión de la agencia. Es preferible no generar nada y que quede
  // el registro, a pagar de más en silencio.
  if (pctAsesor === null) {
    await supabase.from('activities').insert({
      lead_id: params.leadId,
      created_by: params.asesorId,
      type: 'comision_sin_regla',
      description: 'No se generó comisión: el asesor no tiene porcentaje cargado para esta prepaga. Cargalo en el panel de administración y volvé a aprobar el alta.',
    })
    return
  }

  const montoComision = Number(montoBase) * Number(pctAsesor) / 100

  const cierre = await getOrCreateCierreAbierto(supabase, params.prepagaId)

  // Snapshot del líder del vendedor al momento de la venta. Se congela a
  // propósito: si el asesor cambia de equipo después, recalcularlo reescribiría
  // el pasado de dos líderes a la vez (uno perdería liquidaciones ya cobradas).
  // Se busca por relación, no por rol: quien figura acá puede ser supervisor,
  // admin o admin_principal.
  const { data: rel } = await adminSupabase
    .from('admin_asesores')
    .select('admin_id')
    .eq('asesor_id', params.asesorId)
    .maybeSingle()
  const supervisorId = rel?.admin_id ?? null

  // Base común a todas las filas de esta venta.
  const comun = {
    alta_id: params.altaId,
    lead_id: params.leadId,
    // asesor_id conserva su significado histórico: QUIÉN VENDIÓ. También en las
    // filas de override, donde el beneficiario es otro.
    asesor_id: params.asesorId,
    vendedor_id: params.asesorId,
    prepaga_id: params.prepagaId,
    segmento: params.segmento,
    origen,
    tipo_base: regla.tipo_base,
    monto_base: montoBase,
    cierre_id: cierre?.id ?? null,
  }

  const filas: TablesInsert<'comisiones'>[] = [{
    ...comun,
    beneficiario_id: params.asesorId,
    supervisor_id: supervisorId,
    tipo: 'directa',
    porcentaje: regla.porcentaje,
    comision_pct_asesor: pctAsesor,
    monto_comision: montoComision,
  }]

  // ---------------------------------------------------------------------------
  // Overrides
  //
  // Se disparan POR RELACIÓN, nunca por `profiles.role`. Quien figura como
  // líder puede tener rol supervisor, admin o admin_principal — el caso de una
  // admin que además conduce un equipo. Si esto preguntara por el rol, esa
  // persona no cobraría y no habría ningún error que lo delate: simplemente
  // faltaría una fila en la liquidación.
  //
  // El override es % DE LA CUOTA, igual que el de la prepaga y el del asesor.
  // Todos los porcentajes del sistema están en la misma unidad y se restan
  // contra la facturación; ninguno se multiplica por otro.
  // ---------------------------------------------------------------------------
  const hoy = new Date().toISOString().slice(0, 10)

  const overrideVigente = async (personaId: string) => {
    const { data } = await adminSupabase
      .from('supervisor_overrides')
      .select('pct_equipo, pct_venta_propia')
      .eq('supervisor_id', personaId)
      .eq('prepaga_id', params.prepagaId)
      .eq('activo', true)
      .lte('vigente_desde', hoy)
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }

  // 1. Override del líder sobre la venta de su asesor.
  //    La guarda supervisorId !== asesorId evita emitir dos veces si alguien
  //    quedara cargado como líder de sí mismo: ese caso lo cubre el punto 2.
  if (supervisorId && supervisorId !== params.asesorId) {
    const ov = await overrideVigente(supervisorId)
    if (ov?.pct_equipo != null) {
      filas.push({
        ...comun,
        beneficiario_id: supervisorId,
        supervisor_id: supervisorId,
        tipo: 'override',
        porcentaje: ov.pct_equipo,
        comision_pct_asesor: null,
        monto_comision: Number(montoBase) * Number(ov.pct_equipo) / 100,
      })
    }
  }

  // 2. Override del propio vendedor sobre su venta, si tiene equipo y se le
  //    cargó `pct_venta_propia`. Que ese campo esté en NULL es exactamente lo
  //    que significa "no cobra override sobre lo propio".
  const ovPropio = await overrideVigente(params.asesorId)
  if (ovPropio?.pct_venta_propia != null) {
    filas.push({
      ...comun,
      beneficiario_id: params.asesorId,
      supervisor_id: params.asesorId,
      tipo: 'override',
      porcentaje: ovPropio.pct_venta_propia,
      comision_pct_asesor: null,
      monto_comision: Number(montoBase) * Number(ovPropio.pct_venta_propia) / 100,
    })
  }

  const { error: errInsert } = await supabase.from('comisiones').insert(filas)
  if (errInsert) {
    console.error('generarComisionParaAlta:', errInsert)
    await supabase.from('activities').insert({
      lead_id: params.leadId,
      created_by: params.asesorId,
      type: 'comision_sin_regla',
      description: `No se pudieron generar las comisiones: ${errInsert.message}`,
    })
  }

  const montoFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(montoComision)
  await supabase.from('activities').insert({
    lead_id: params.leadId,
    created_by: params.asesorId,
    type: 'comision_generada',
    description: `Comisión generada: ${montoFmt} (origen: ${origen}${cierre ? `, lote ${cierre.mes_periodo}` : ''})`,
  })
}

export async function getComisionesAdmin() {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('comisiones')
    .select(`
      *,
      leads(first_name, last_name, campaigns(name)),
      prepagas(nombre, slug),
      profiles!comisiones_asesor_id_fkey(first_name, last_name),
      cierres_comisionales(id, mes_periodo, estado)
    `)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getMisComisiones() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('comisiones')
    .select(`
      *,
      leads(first_name, last_name, campaigns(name)),
      prepagas(nombre, slug),
      cierres_comisionales(mes_periodo, estado)
    `)
    // beneficiario_id, NO asesor_id: esta pantalla es "lo que YO cobro".
    // Con el modelo de override, una fila puede tener asesor_id = el vendedor
    // y beneficiario_id = su líder. Filtrando por asesor_id, un líder nunca
    // vería sus propios overrides.
    .eq('beneficiario_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function marcarComisionLiquidada(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('comisiones')
    .update({ estado: 'liquidada', liquidada_at: new Date().toISOString(), liquidada_by: guard.user!.id })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/comisiones')
  revalidatePath('/comisiones')
  return { success: true }
}

// ---------------------------------------------------------------------------
// REGLAS DE COMISIÓN (admin)
// ---------------------------------------------------------------------------

export async function getReglasComision() {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('prepaga_comision_reglas')
    .select('*, prepagas(nombre, slug)')
    .order('segmento', { ascending: true })
  return data ?? []
}

const ReglaComisionSchema = z.object({
  id: z.string().uuid().optional(),
  prepaga_id: z.string().uuid(),
  segmento: z.enum(['particular', 'relacion_dependencia', 'monotributo', 'pmo']),
  // null = regla general: aplica a cualquier origen que no tenga regla específica
  origen: z.enum(['nexo', 'referido', 'campania']).nullable(),
  tipo_base: z.enum(['valor_plan', 'pct_sueldo_bruto']),
  porcentaje: z.coerce.number().min(0).max(1000),
  notas: z.string().optional().nullable(),
})

export async function guardarReglaComision(values: z.infer<typeof ReglaComisionSchema>) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const parsed = ReglaComisionSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { id, ...campos } = parsed.data
  const payload = { ...campos, notas: campos.notas || null, updated_at: new Date().toISOString() }

  const { error } = id
    ? await supabase.from('prepaga_comision_reglas').update(payload).eq('id', id)
    : await supabase.from('prepaga_comision_reglas').insert(payload)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una regla para esa combinación de prepaga, segmento y origen' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/comisiones/reglas')
  return { success: true }
}

export async function eliminarReglaComision(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase.from('prepaga_comision_reglas').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/comisiones/reglas')
  return { success: true }
}

// ---------------------------------------------------------------------------
// CIERRES COMISIONALES (lotes)
// ---------------------------------------------------------------------------

export async function getCierresAdmin() {
  const guard = await assertAdmin()
  if (guard.error) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('cierres_comisionales')
    .select(`
      *,
      prepagas(nombre, slug),
      comisiones(
        id, monto_comision, estado, segmento, origen, created_at,
        leads(first_name, last_name, campaigns(name)),
        profiles!comisiones_asesor_id_fkey(first_name, last_name)
      )
    `)
    .order('mes_periodo', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

// Cierra el lote: deja de recibir ventas nuevas (las próximas aprobadas abren otro lote).
export async function cerrarCierre(id: string, fechaPagoEstimada?: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('cierres_comisionales')
    .update({
      estado: 'cerrado',
      fecha_cierre: new Date().toISOString().slice(0, 10),
      cerrado_at: new Date().toISOString(),
      cerrado_by: guard.user!.id,
      fecha_pago_estimada: fechaPagoEstimada ?? null,
    })
    .eq('id', id)
    .eq('estado', 'abierto')

  if (error) return { error: error.message }
  revalidatePath('/admin/comisiones')
  revalidatePath('/comisiones')
  return { success: true }
}

// Liquida el lote completo: marca el cierre y todas sus comisiones pendientes.
export async function liquidarCierre(id: string) {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  const supabase = await createClient()
  const ahora = new Date().toISOString()

  const { error: errorCierre } = await supabase
    .from('cierres_comisionales')
    .update({ estado: 'liquidado', liquidado_at: ahora, liquidado_by: guard.user!.id })
    .eq('id', id)
    .in('estado', ['abierto', 'cerrado'])

  if (errorCierre) return { error: errorCierre.message }

  const { error: errorComisiones } = await supabase
    .from('comisiones')
    .update({ estado: 'liquidada', liquidada_at: ahora, liquidada_by: guard.user!.id })
    .eq('cierre_id', id)
    .eq('estado', 'pendiente')

  if (errorComisiones) return { error: errorComisiones.message }

  revalidatePath('/admin/comisiones')
  revalidatePath('/comisiones')
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

// ---------------------------------------------------------------------------
// ALTAS — subida de adjuntos a la carpeta de Drive del trámite
// ---------------------------------------------------------------------------

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

export async function subirAdjuntoDrive(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const altaId = String(formData.get('alta_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')
  const file = formData.get('file')

  if (!altaId || !itemId) return { error: 'Faltan datos del adjunto' }
  if (!(file instanceof File)) return { error: 'Archivo inválido' }
  if (file.size === 0) return { error: 'El archivo está vacío' }
  if (file.size > MAX_BYTES) return { error: 'El archivo supera los 15 MB' }
  if (file.type && !MIME_PERMITIDOS.includes(file.type)) {
    return { error: 'Formato no permitido (PDF, JPG, PNG o WEBP)' }
  }

  // Buscar la carpeta de Drive del alta y la etiqueta del ítem
  const { data: alta } = await supabase
    .from('altas')
    .select('id, drive_folder_id, asesor_id')
    .eq('id', altaId)
    .single()
  if (!alta) return { error: 'Alta no encontrada' }
  if (!alta.drive_folder_id) {
    return { error: 'El alta no tiene carpeta en Drive. Creala primero desde el detalle del alta.' }
  }

  const { data: item } = await supabase
    .from('alta_items')
    .select('id, etiqueta')
    .eq('id', itemId)
    .eq('alta_id', altaId)
    .single()
  if (!item) return { error: 'Ítem no encontrado' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const etiquetaLimpia = item.etiqueta.replace(/[\\/:*?"<>|]/g, '').trim()
    const nombreArchivo = `${etiquetaLimpia}${ext}`
    const mime = file.type || 'application/octet-stream'

    const subido = await subirArchivoDrive(alta.drive_folder_id, buffer, nombreArchivo, mime)

    const { error } = await supabase
      .from('alta_items')
      .update({
        completado: true,
        drive_file_id: subido.id,
        drive_file_url: subido.urlVista,
        completado_by: user.id,
        completado_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('alta_id', altaId)

    if (error) return { error: error.message }
    revalidatePath(`/altas/${altaId}`)
    return { data: { url: subido.urlVista } }
  } catch (err) {
    console.error('[Alta] Error subiendo a Drive:', err)
    return { error: 'No se pudo subir el archivo a Drive' }
  }
}

// ---------------------------------------------------------------------------
// ALTAS — datos comerciales del trámite
// ---------------------------------------------------------------------------

const DatosComercialesSchema = z.object({
  alta_id: z.string().uuid(),
  plan_codigo: z.string().optional().nullable(),
  // `tipo_alta` reemplaza al viejo campo libre `condicion`. Eran el mismo
  // concepto duplicado: uno se mostraba en pantalla y el otro definía la escala
  // comisional, sin nada que impidiera que dijeran cosas distintas.
  tipo_alta: z.enum(['particular', 'relacion_dependencia', 'monotributo', 'pmo']).optional().nullable(),
  cantidad_capitas: z.number().int().nonnegative().optional().nullable(),
  cuota: z.number().nonnegative().optional().nullable(),
  aportes_promedio: z.number().nonnegative().optional().nullable(),
  sueldo_bruto: z.number().nonnegative().optional().nullable(),
  periodo_aportes: z.string().optional().nullable(),
  medio_pago: z.string().optional().nullable(),
})

export async function guardarDatosComerciales(input: z.infer<typeof DatosComercialesSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = DatosComercialesSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { alta_id, ...campos } = parsed.data

  const { data: altaCheck } = await supabase
    .from('altas').select('estado').eq('id', alta_id).single()
  if (!altaCheck) return { error: 'Alta no encontrada' }
  if (['aprobada', 'rechazada'].includes(altaCheck.estado)) {
    return { error: 'El alta ya no puede editarse en su estado actual' }
  }

  const { error } = await supabase.from('altas').update(campos).eq('id', alta_id)
  if (error) return { error: error.message }
  revalidatePath(`/altas/${alta_id}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// ALTAS — integrantes (titular + grupo familiar)
// ---------------------------------------------------------------------------

export async function getIntegrantes(altaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('alta_integrantes')
    .select('*')
    .eq('alta_id', altaId)
    .order('orden', { ascending: true })
  return data ?? []
}

const IntegranteSchema = z.object({
  alta_id: z.string().uuid(),
  rol: z.enum(['titular', 'conyuge', 'hijo', 'adherente']).default('hijo'),
  nombre: z.string().optional().nullable(),
  dni: z.string().optional().nullable(),
  cuil: z.string().optional().nullable(),
  fecha_nac: z.string().optional().nullable(),
  edad: z.number().int().nonnegative().optional().nullable(),
  peso_kg: z.number().nonnegative().optional().nullable(),
  altura_cm: z.number().nonnegative().optional().nullable(),
  domicilio: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  parentesco: z.string().optional().nullable(),
  fum: z.string().optional().nullable(),
})

export async function agregarIntegrante(input: z.infer<typeof IntegranteSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const parsed = IntegranteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // orden = siguiente disponible
  const { data: existentes } = await supabase
    .from('alta_integrantes')
    .select('orden')
    .eq('alta_id', parsed.data.alta_id)
    .order('orden', { ascending: false })
    .limit(1)
  const orden = (existentes?.[0]?.orden ?? -1) + 1

  const { data, error } = await supabase
    .from('alta_integrantes')
    .insert({ ...parsed.data, orden })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/altas/${parsed.data.alta_id}`)
  return { data }
}

export async function actualizarIntegrante(
  id: string,
  input: Partial<z.infer<typeof IntegranteSchema>> & { alta_id: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { alta_id, ...campos } = input
  const { error } = await supabase.from('alta_integrantes').update(campos).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/altas/${alta_id}`)
  return { success: true }
}

export async function eliminarIntegrante(id: string, altaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('alta_integrantes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/altas/${altaId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// ALTAS — resumen del trámite (texto + documento en Drive)
// ---------------------------------------------------------------------------

// El resumen que se envía a procesar sigue hablando de "condición", que es el
// vocabulario de las prepagas. Lo que cambió es de dónde sale: antes era un
// campo libre propio, ahora se deriva de `tipo_alta`, que es el mismo dato con
// el que se liquida la comisión. Así el texto que se manda y la plata que se
// paga no pueden decir cosas distintas.
const TIPO_ALTA_LABEL: Record<string, string> = {
  particular: 'Directo / Particular',
  relacion_dependencia: 'Relación de dependencia',
  monotributo: 'Monotributo',
  pmo: 'PMO / Aportes',
}

export async function generarResumenAlta(altaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: alta } = await supabase
    .from('altas')
    .select(`
      id, drive_folder_id, plan_codigo, tipo_alta, cantidad_capitas, cuota,
      aportes_promedio, sueldo_bruto, periodo_aportes, plantilla_id,
      prepagas(nombre, slug),
      prepaga_planes(nombre)
    `)
    .eq('id', altaId)
    .single()
  if (!alta) return { error: 'Alta no encontrada' }

  // Cargar el template de resumen de la plantilla (si tiene)
  let resumenTemplate: string | null = null
  if (alta.plantilla_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plantilla } = await (supabase.from('checklist_plantillas') as any)
      .select('resumen_template')
      .eq('id', alta.plantilla_id)
      .single()
    resumenTemplate = (plantilla as { resumen_template?: string | null })?.resumen_template ?? null
  }

  // Cargar datos específicos (ítems con seccion='datos') para interpolación
  const { data: datosRaw } = await supabase
    .from('alta_items')
    .select('etiqueta, valor_texto, valor_numero, valor_fecha')
    .eq('alta_id', altaId)
    .eq('seccion', 'datos')
  const datosItems = (datosRaw ?? []) as DatoItem[]

  const integrantes = (await getIntegrantes(altaId)) as unknown as ResumenIntegrante[]
  const prepaga = alta.prepagas as { nombre: string; slug: string } | null
  const plan = alta.prepaga_planes as { nombre: string } | null

  const texto = generarResumenTexto(
    {
      prepagaNombre: prepaga?.nombre ?? '',
      prepagaSlug: prepaga?.slug ?? '',
      planNombre: plan?.nombre ?? null,
      planCodigo: alta.plan_codigo,
      condicion: TIPO_ALTA_LABEL[alta.tipo_alta ?? ''] ?? alta.tipo_alta,
      cantidadCapitas: alta.cantidad_capitas,
      cuota: alta.cuota,
      aportesPromedio: alta.aportes_promedio,
      sueldoBruto: alta.sueldo_bruto,
      periodoAportes: alta.periodo_aportes,
    },
    integrantes,
    datosItems,
    resumenTemplate
  )

  // Guardar en Drive (best-effort) si hay carpeta
  const update: Record<string, unknown> = { resumen_texto: texto }
  if (alta.drive_folder_id) {
    try {
      const doc = await guardarDocResumen(
        alta.drive_folder_id,
        'Resumen del trámite',
        texto
      )
      update.resumen_drive_id = doc.id
      update.resumen_drive_url = doc.urlVista
    } catch (err) {
      console.error('[Alta] Error guardando resumen en Drive:', err)
    }
  }

  await supabase.from('altas').update(update).eq('id', altaId)
  revalidatePath(`/altas/${altaId}`)
  return {
    data: {
      texto,
      driveUrl: (update.resumen_drive_url as string) ?? null,
    },
  }
}
