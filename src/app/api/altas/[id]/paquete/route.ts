import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/supabase/assert-admin'
import { sanitizarNombreCarpeta } from '@/lib/google-drive'
import { generarResumenAlta } from '@/app/actions/prepaga-actions'

/**
 * Paquete del trámite: un ZIP con la documentación y el resumen.
 *
 * Existe porque el admin manda el alta a la prepaga por mail o WhatsApp
 * adjuntando los archivos. Sin esto tendría que bajar los documentos del CRM
 * de a uno.
 *
 * Solo admin: es la documentación completa del socio (DNI, recibo de sueldo,
 * medio de pago) en un solo archivo. Un asesor no necesita descargarla junta.
 */
// JSZip no marca los nombres de entrada como UTF-8, así que un archivo llamado
// "Constancia de derivación" se abre como "Constancia de derivaciÃ³n" en el
// Explorador de Windows. Como estos nombres terminan siendo archivos en la
// máquina del admin, se les sacan los acentos.
function nombreEnZip(etiqueta: string): string {
  return sanitizarNombreCarpeta(
    etiqueta.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('No autenticado', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) {
    return new NextResponse('Solo un administrador puede descargar el paquete', { status: 403 })
  }

  // El select pasa por RLS: si este admin no puede ver el alta, no hay fila.
  // No se re-chequea el alcance acá a mano — el RLS es la definición.
  const { data: alta } = await supabase
    .from('altas')
    .select(`
      id,
      prepagas(nombre),
      leads(first_name, last_name, dni),
      alta_items(etiqueta, archivo_path, momento, requerido)
    `)
    .eq('id', id)
    .single()

  if (!alta) return new NextResponse('Alta no encontrada', { status: 404 })

  const lead = alta.leads as { first_name: string; last_name: string | null; dni: string | null } | null
  const prepaga = alta.prepagas as { nombre: string } | null
  const items = (alta.alta_items ?? []) as {
    etiqueta: string; archivo_path: string | null; momento: string; requerido: boolean
  }[]

  const zip = new JSZip()

  // El resumen se regenera en vez de leer `altas.resumen_texto`: ese campo es
  // un cache de la última vez que alguien apretó "Generar", y si después se
  // corrigió un dato el paquete saldría con el texto viejo.
  const resumen = await generarResumenAlta(id)
  if (resumen.data?.texto) {
    zip.file('resumen.txt', resumen.data.texto)
  }

  const fallidos: string[] = []
  const conArchivo = items.filter(i => i.archivo_path)

  // La descarga usa el cliente del usuario: la policy de SELECT del bucket
  // vuelve a decidir. Un admin que no puede ver el alta tampoco baja sus
  // archivos, sin que este código tenga que repetir la regla.
  for (const item of conArchivo) {
    const { data: blob, error } = await supabase.storage
      .from('altas-adjuntos')
      .download(item.archivo_path!)

    if (error || !blob) {
      fallidos.push(item.etiqueta)
      continue
    }

    // La extensión sale del path: lo que se guarda en la base es
    // <alta_id>/<item_id>.<ext>, no el nombre original del archivo.
    const extension = item.archivo_path!.includes('.')
      ? item.archivo_path!.slice(item.archivo_path!.lastIndexOf('.'))
      : ''
    const prefijo = item.momento === 'post_aprobacion' ? 'POSTERIOR - ' : ''
    zip.file(
      `${prefijo}${nombreEnZip(item.etiqueta)}${extension}`,
      Buffer.from(await blob.arrayBuffer())
    )
  }

  // Faltantes y fallidos van dentro del ZIP, no en un error: el admin muchas
  // veces necesita mandar lo que hay. Mejor que sepa qué le falta a que crea
  // que el paquete está completo.
  const pendientes = items.filter(i => i.requerido && !i.archivo_path).map(i => i.etiqueta)
  if (pendientes.length > 0 || fallidos.length > 0) {
    const lineas: string[] = []
    if (pendientes.length > 0) {
      lineas.push('Documentos requeridos sin cargar en el CRM:', ...pendientes.map(e => `  - ${e}`), '')
    }
    if (fallidos.length > 0) {
      lineas.push('Documentos que no se pudieron descargar:', ...fallidos.map(e => `  - ${e}`))
    }
    zip.file('_FALTANTES.txt', lineas.join('\n'))
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  const nombreSocio = [lead?.last_name, lead?.first_name].filter(Boolean).join(' ') || 'alta'
  const nombreZip = nombreEnZip(
    [prepaga?.nombre, nombreSocio, lead?.dni].filter(Boolean).join(' - ')
  ) + '.zip'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      // filename* en UTF-8 para que no se rompan los acentos del apellido.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombreZip)}`,
      'Cache-Control': 'no-store',
    },
  })
}
