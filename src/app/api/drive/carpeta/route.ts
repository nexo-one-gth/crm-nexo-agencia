import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listarContenidoCarpeta, esDescendienteDeAlguna } from '@/lib/google-drive'
import { isAdminRole } from '@/lib/supabase/assert-admin'

// Devuelve las carpetas raíz de Drive que el usuario puede navegar:
// la carpeta global (env) + las drive_folder_id de las prepagas visibles.
async function getCarpetasPermitidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const roots: string[] = []
  const globalRoot = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (globalRoot) roots.push(globalRoot)

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userId).single()

  let query = supabase
    .from('prepagas')
    .select('id, drive_folder_id')
    .not('drive_folder_id', 'is', null)

  if (!isAdminRole(profile?.role)) {
    const { data: asignadas } = await supabase
      .from('prepaga_asesores_safe')
      .select('prepaga_id')
      .eq('asesor_id', userId)
      .eq('activo', true)
    const ids = (asignadas ?? []).map(a => a.prepaga_id).filter(Boolean) as string[]
    if (ids.length === 0) return roots
    query = query.in('id', ids)
  }

  const { data } = await query
  for (const p of data ?? []) {
    if (p.drive_folder_id) roots.push(p.drive_folder_id)
  }
  return roots
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const folderId = request.nextUrl.searchParams.get('folderId')?.trim()
  if (!folderId) {
    return NextResponse.json({ error: 'folderId requerido' }, { status: 400 })
  }

  const rootsPermitidas = await getCarpetasPermitidas(supabase, user.id)
  const autorizado = await esDescendienteDeAlguna(folderId, rootsPermitidas)
  if (!autorizado) {
    return NextResponse.json({ error: 'Carpeta no autorizada' }, { status: 403 })
  }

  try {
    const items = await listarContenidoCarpeta(folderId)
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'Error al acceder a Google Drive' }, { status: 502 })
  }
}
