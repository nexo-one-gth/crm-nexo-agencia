'use server'

import { createClient } from '@/lib/supabase/server'
import { assertSupervisorOrAdmin } from '@/lib/supabase/assert-admin'
import { assignLeadsToAdvisor } from '@/app/actions/lead-actions'
import { revalidatePath } from 'next/cache'

export interface AsesorEquipo {
  id: string
  nombre: string
  email: string | null
  total: number
  activos: number // leads en etapas de trabajo (no ganado/perdido)
}

export interface LeadPendiente {
  id: string
  nombre: string
  telefono: string | null
  etapa: string
  created_at: string
  origen: 'mia' | 'pool' // 'mia' = asignado al supervisor para repartir; 'pool' = sin asignar
}

export interface MiEquipoData {
  asesores: AsesorEquipo[]
  pendientes: LeadPendiente[]
  esAdminPrincipal: boolean
}

const ETAPAS_CERRADAS = new Set(['Ganado', 'No Interesado'])

// Datos para la pantalla "Mi equipo": asesores del admin (con su carga) + pool
// de leads sin asignar que el admin puede repartir.
export async function getMiEquipoReparto(): Promise<{ data?: MiEquipoData; error?: string }> {
  const guard = await assertSupervisorOrAdmin()
  if (guard.error || !guard.user) return { error: guard.error ?? 'No autenticado' }
  const callerId = guard.user.id

  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('profiles').select('role').eq('id', callerId).single()
  const esAdminPrincipal = perfil?.role === 'admin_principal'

  // Ids de los asesores del equipo
  let asesorIds: string[]
  if (esAdminPrincipal) {
    const { data } = await supabase.from('profiles').select('id').eq('role', 'asesor')
    asesorIds = (data ?? []).map(a => a.id)
  } else {
    const { data } = await supabase
      .from('admin_asesores').select('asesor_id').eq('admin_id', callerId)
    asesorIds = (data ?? []).map(a => a.asesor_id)
  }

  // Perfiles del equipo
  const perfiles = asesorIds.length
    ? (await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', asesorIds)
        .order('first_name', { ascending: true })).data ?? []
    : []

  // Carga por asesor: leads asignados no borrados, con su etapa
  const cargaPorAsesor = new Map<string, { total: number; activos: number }>()
  if (asesorIds.length) {
    const { data: leadsEquipo } = await supabase
      .from('leads')
      .select('assigned_to, pipeline_stages!inner(name)')
      .in('assigned_to', asesorIds)
      .is('deleted_at', null)
    for (const l of (leadsEquipo ?? []) as Array<{ assigned_to: string; pipeline_stages: { name: string } }>) {
      const cur = cargaPorAsesor.get(l.assigned_to) ?? { total: 0, activos: 0 }
      cur.total += 1
      if (!ETAPAS_CERRADAS.has(l.pipeline_stages?.name)) cur.activos += 1
      cargaPorAsesor.set(l.assigned_to, cur)
    }
  }

  const asesores: AsesorEquipo[] = perfiles.map(p => {
    const c = cargaPorAsesor.get(p.id) ?? { total: 0, activos: 0 }
    return {
      id: p.id,
      nombre: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email ?? 'Asesor'),
      email: p.email,
      total: c.total,
      activos: c.activos,
    }
  })

  // Pendientes de reparto: lo que le asignaron al supervisor (su bucket) + el pool
  // general sin asignar. Ambos son leads que todavía no están en manos de un asesor.
  const { data: pend } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, assigned_to, created_at, pipeline_stages!inner(name)')
    .or(`assigned_to.eq.${callerId},assigned_to.is.null`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const pendientes: LeadPendiente[] = ((pend ?? []) as Array<{
    id: string; first_name: string | null; last_name: string | null
    phone: string | null; assigned_to: string | null; created_at: string; pipeline_stages: { name: string }
  }>).map(l => ({
    id: l.id,
    nombre: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Sin nombre',
    telefono: l.phone,
    etapa: l.pipeline_stages?.name ?? '—',
    created_at: l.created_at,
    origen: l.assigned_to === callerId ? 'mia' : 'pool',
  }))

  return { data: { asesores, pendientes, esAdminPrincipal } }
}

// Reparto equitativo (round-robin) de un conjunto de leads entre varios asesores.
// Reusa assignLeadsToAdvisor para conservar la lógica de etapa/campaña/origen.
export async function repartirEquitativo(
  leadIds: string[],
  asesorIds: string[]
): Promise<{ success?: boolean; asignados?: number; error?: string }> {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }
  if (!leadIds.length) return { error: 'No seleccionaste leads' }
  if (!asesorIds.length) return { error: 'Elegí al menos un asesor' }

  // Distribución round-robin
  const grupos = new Map<string, string[]>()
  asesorIds.forEach(id => grupos.set(id, []))
  leadIds.forEach((leadId, i) => {
    const asesor = asesorIds[i % asesorIds.length]
    grupos.get(asesor)!.push(leadId)
  })

  let asignados = 0
  for (const [asesorId, ids] of grupos) {
    if (!ids.length) continue
    const res = await assignLeadsToAdvisor(ids, asesorId)
    if (res.success) asignados += ids.length
    else return { error: res.error ?? 'Error al repartir', asignados }
  }

  revalidatePath('/equipo')
  revalidatePath('/funnel')
  return { success: true, asignados }
}
