'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificacionUI = {
  id: string
  tipo: string
  titulo: string
  cuerpo: string | null
  link: string | null
  cantidad: number
  leida_at: string | null
  created_at: string
}

const LIMITE = 20

/**
 * Las últimas notificaciones del usuario logueado. No filtra por
 * destinatario_id a mano: manda el RLS (`notificaciones_select_propias`), como
 * el resto del proyecto.
 */
export async function getMisNotificaciones(): Promise<{
  data: NotificacionUI[]
  noLeidas: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], noLeidas: 0, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, cuerpo, link, cantidad, leida_at, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMITE)

  if (error) {
    console.error('[notificaciones] error al listar', error)
    return { data: [], noLeidas: 0, error: error.message }
  }

  const lista = (data ?? []) as NotificacionUI[]
  return { data: lista, noLeidas: lista.filter(n => !n.leida_at).length }
}

export async function marcarNotificacionLeida(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // El grant de columnas en la migración limita el UPDATE a `leida_at`, así
  // que ni siquiera hace falta confiar en que el cliente mande solo eso.
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_at: new Date().toISOString() })
    .eq('id', id)
    .is('leida_at', null)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function marcarTodasLeidas(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_at: new Date().toISOString() })
    .is('leida_at', null)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
