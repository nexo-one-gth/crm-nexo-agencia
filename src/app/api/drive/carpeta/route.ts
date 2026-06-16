import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listarContenidoCarpeta, esBajoCarpetaRaiz } from '@/lib/google-drive'

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

  const autorizado = await esBajoCarpetaRaiz(folderId)
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
