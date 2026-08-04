'use server'

import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/supabase/assert-admin'
import {
  listarContenidoCarpeta,
  descargarArchivoDrive,
  extraerTextoPdf,
  type DriveItem,
} from '@/lib/google-drive'
import {
  parseTarifarioPremedic,
  type TarifaRow,
} from '@/lib/premedic/parseTarifarioPremedic'
import { revalidatePath } from 'next/cache'

const PREMEDIC_ID = '4ebf732d-4af2-45f9-9b93-651c3db71a8c'

// Carpeta madre de tarifarios de Premedic en Drive: adentro se crean
// subcarpetas por mes (ej. "AGOSTO '26") con los PDFs de cada lista.
// La carpeta debe estar compartida con el service account (GOOGLE_SERVICE_ACCOUNT_EMAIL).
// Se puede sobreescribir por env sin tocar código.
const TARIFARIO_FOLDER_ID =
  process.env.PREMEDIC_TARIFARIO_FOLDER_ID ?? '133D4UeOQ4An2lbw8hEGZT6YCWG0gFpjP'

export interface MesTarifario {
  folderId: string
  nombre: string
  pdfs: DriveItem[]
}

// ---------------------------------------------------------------------------
// Tipos de preview
// ---------------------------------------------------------------------------
export interface FilaPreview {
  plan_id: string | null
  plan_nombre: string
  composicion: string
  edad_titular_min: number | null
  edad_titular_max: number | null
  precio: number
  precio_anterior: number | null
  variacion_pct: number | null
}

export interface PreviewTarifario {
  vigencia_desde: string
  zona: 'amba' | 'interior'
  modalidad: 'directo' | 'desregulado'
  filas: FilaPreview[]
  warnings: string[]
  planesNoEncontrados: string[]
  yaCargado: boolean
  resumen: {
    total: number
    conAnterior: number
    variacionPromedio: number | null
  }
}

// ---------------------------------------------------------------------------
// Listar los tarifarios agrupados por mes (subcarpeta de la carpeta madre)
// ---------------------------------------------------------------------------
export async function listarTarifariosPremedic(): Promise<{ meses: MesTarifario[]; error?: string }> {
  const guard = await assertAdmin()
  if (guard.error) return { meses: [], error: guard.error }

  try {
    const raiz = await listarContenidoCarpeta(TARIFARIO_FOLDER_ID)
    const esPdf = (i: DriveItem) => i.esArchivo && i.mimeType === 'application/pdf'

    const meses: MesTarifario[] = []

    // PDFs sueltos directamente en la carpeta madre (por las dudas)
    const sueltos = raiz.filter(esPdf)
    if (sueltos.length) meses.push({ folderId: TARIFARIO_FOLDER_ID, nombre: 'Sin carpeta', pdfs: sueltos })

    // Subcarpetas = meses
    const subcarpetas = raiz.filter(i => !i.esArchivo)
    for (const sub of subcarpetas) {
      try {
        const hijos = await listarContenidoCarpeta(sub.id)
        const pdfs = hijos.filter(esPdf)
        if (pdfs.length) meses.push({ folderId: sub.id, nombre: sub.nombre, pdfs })
      } catch {
        // subcarpeta inaccesible: se omite
      }
    }

    if (meses.length === 0) {
      return { meses: [], error: 'No se encontraron PDFs. ¿La carpeta está compartida con el service account?' }
    }
    return { meses }
  } catch {
    return { meses: [], error: 'No se pudo acceder a la carpeta de tarifarios en Drive. Verificá que esté compartida con el service account.' }
  }
}

// ---------------------------------------------------------------------------
// Preview desde un PDF de Drive
// ---------------------------------------------------------------------------
export async function previsualizarTarifarioDrive(fileId: string): Promise<{ data?: PreviewTarifario; error?: string }> {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }

  let texto: string
  try {
    const buffer = await descargarArchivoDrive(fileId)
    texto = await extraerTextoPdf(buffer)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error leyendo el PDF de Drive' }
  }
  return previsualizarDesdeTexto(texto)
}

// ---------------------------------------------------------------------------
// Preview desde texto pegado (fallback si la extracción de PDF falla)
// ---------------------------------------------------------------------------
export async function previsualizarTarifarioTexto(texto: string): Promise<{ data?: PreviewTarifario; error?: string }> {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }
  return previsualizarDesdeTexto(texto)
}

// Núcleo compartido: parsea, resuelve plan_id y compara contra la lista vigente.
async function previsualizarDesdeTexto(texto: string): Promise<{ data?: PreviewTarifario; error?: string }> {
  let parsed: ReturnType<typeof parseTarifarioPremedic>
  try {
    parsed = parseTarifarioPremedic(texto)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo interpretar el tarifario' }
  }
  if (parsed.rows.length === 0) {
    return { error: 'El PDF no arrojó ninguna fila. Revisá que sea una lista de precios de Premedic.' }
  }

  const supabase = await createClient()

  // Resolver plan_nombre -> plan_id
  const { data: planes } = await supabase
    .from('prepaga_planes').select('id, nombre').eq('prepaga_id', PREMEDIC_ID)
  const planPorNombre = new Map((planes ?? []).map(p => [p.nombre, p.id]))

  // Lista vigente actual para esa zona/modalidad (para comparar y detectar re-carga)
  const { data: vigentes } = await supabase
    .from('prepaga_tarifas')
    .select('plan_id, composicion, edad_titular_min, edad_titular_max, precio, vigencia_desde')
    .eq('prepaga_id', PREMEDIC_ID)
    .eq('zona', parsed.zona)
    .eq('modalidad', parsed.modalidad)
    .is('vigencia_hasta', null)

  const claveDe = (plan_id: string, comp: string, emin: number | null, emax: number | null) =>
    `${plan_id}|${comp}|${emin ?? 'x'}|${emax ?? 'x'}`
  const vigentePorClave = new Map(
    (vigentes ?? []).map(v => [claveDe(v.plan_id, v.composicion, v.edad_titular_min, v.edad_titular_max), Number(v.precio)])
  )
  const yaCargado = (vigentes ?? []).some(v => v.vigencia_desde === parsed.vigencia_desde)

  const planesNoEncontrados = new Set<string>()
  const filas: FilaPreview[] = parsed.rows.map(r => {
    const plan_id = planPorNombre.get(r.plan_nombre) ?? null
    if (!plan_id) planesNoEncontrados.add(r.plan_nombre)
    const anterior = plan_id
      ? vigentePorClave.get(claveDe(plan_id, r.composicion, r.edad_titular_min, r.edad_titular_max)) ?? null
      : null
    const variacion = anterior && anterior > 0 ? ((r.precio / anterior) - 1) * 100 : null
    return {
      plan_id,
      plan_nombre: r.plan_nombre,
      composicion: r.composicion,
      edad_titular_min: r.edad_titular_min,
      edad_titular_max: r.edad_titular_max,
      precio: r.precio,
      precio_anterior: anterior,
      variacion_pct: variacion,
    }
  })

  const conAnterior = filas.filter(f => f.variacion_pct !== null)
  const variacionPromedio = conAnterior.length
    ? conAnterior.reduce((a, f) => a + (f.variacion_pct ?? 0), 0) / conAnterior.length
    : null

  return {
    data: {
      vigencia_desde: parsed.vigencia_desde,
      zona: parsed.zona,
      modalidad: parsed.modalidad,
      filas,
      warnings: parsed.warnings,
      planesNoEncontrados: [...planesNoEncontrados],
      yaCargado,
      resumen: { total: filas.length, conAnterior: conAnterior.length, variacionPromedio },
    },
  }
}

// ---------------------------------------------------------------------------
// Confirmar la carga: versionado (cerrar lote anterior + insertar el nuevo)
// ---------------------------------------------------------------------------
export async function confirmarTarifario(rows: TarifaRow[]): Promise<{ success?: boolean; insertadas?: number; error?: string }> {
  const guard = await assertAdmin()
  if (guard.error) return { error: guard.error }
  if (!rows.length) return { error: 'No hay filas para cargar' }

  // Todas las filas deben pertenecer a la misma zona/modalidad/vigencia
  const { zona, modalidad, vigencia_desde } = rows[0]
  const homogeneo = rows.every(r => r.zona === zona && r.modalidad === modalidad && r.vigencia_desde === vigencia_desde)
  if (!homogeneo) return { error: 'Las filas mezclan zona/modalidad/vigencia distintas' }

  const supabase = await createClient()

  // Resolver plan_id
  const { data: planes } = await supabase
    .from('prepaga_planes').select('id, nombre').eq('prepaga_id', PREMEDIC_ID)
  const planPorNombre = new Map((planes ?? []).map(p => [p.nombre, p.id]))
  const sinPlan = [...new Set(rows.map(r => r.plan_nombre).filter(n => !planPorNombre.has(n)))]
  if (sinPlan.length) return { error: `Planes sin equivalencia en el sistema: ${sinPlan.join(', ')}` }

  // Idempotencia: no recargar un lote ya vigente para ese mes
  const { data: yaExiste } = await supabase
    .from('prepaga_tarifas')
    .select('id')
    .eq('prepaga_id', PREMEDIC_ID).eq('zona', zona).eq('modalidad', modalidad)
    .eq('vigencia_desde', vigencia_desde).is('vigencia_hasta', null)
    .limit(1)
  if (yaExiste && yaExiste.length) {
    return { error: `Ya hay una lista vigente con vigencia ${vigencia_desde} para ${zona}/${modalidad}. Cerrala antes de recargar.` }
  }

  // Fin del lote anterior = día previo a la nueva vigencia
  const desde = new Date(vigencia_desde + 'T00:00:00Z')
  desde.setUTCDate(desde.getUTCDate() - 1)
  const finMesAnterior = desde.toISOString().slice(0, 10)

  // 1) Cerrar la lista vigente de esa zona/modalidad
  const { error: errCerrar } = await supabase
    .from('prepaga_tarifas')
    .update({ vigencia_hasta: finMesAnterior })
    .eq('prepaga_id', PREMEDIC_ID).eq('zona', zona).eq('modalidad', modalidad)
    .is('vigencia_hasta', null)
  if (errCerrar) return { error: `Error cerrando la lista anterior: ${errCerrar.message}` }

  // 2) Insertar el lote nuevo
  const payload = rows.map(r => ({
    prepaga_id: PREMEDIC_ID,
    plan_id: planPorNombre.get(r.plan_nombre)!,
    zona: r.zona,
    modalidad: r.modalidad,
    composicion: r.composicion,
    edad_titular_min: r.edad_titular_min,
    edad_titular_max: r.edad_titular_max,
    precio: r.precio,
    vigencia_desde: r.vigencia_desde,
  }))
  const { error: errInsert } = await supabase.from('prepaga_tarifas').insert(payload)
  if (errInsert) return { error: `Error insertando el nuevo tarifario: ${errInsert.message}` }

  revalidatePath('/admin/prepagas/tarifas')
  revalidatePath('/prepagas/premedic/cotizar')
  return { success: true, insertadas: payload.length }
}
