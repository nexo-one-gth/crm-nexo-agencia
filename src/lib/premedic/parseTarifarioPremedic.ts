/**
 * Parser del tarifario mensual de Premedic.
 *
 * Toma el TEXTO plano extraído de un PDF de lista de precios de Premedic y lo
 * convierte en filas listas para `prepaga_tarifas`. No hace I/O: recibe el texto
 * ya extraído (Google Drive API, pdf-parse, etc.) para poder testearlo sin PDF.
 *
 * Soporta las 4 listas mensuales (zona × modalidad):
 *   - Desregulado AMBA / Interior
 *   - Directo AMBA / Interior   (incluye recargos 60-64, layout transpuesto)
 *
 * Tolera las variaciones reales de encabezado y posición:
 *   "Vigencia Agosto 2026 AMBA - Desregulados"       (arriba)
 *   "...POR CUALQUIER CONCEPTO Vigencia Agosto 2026 INTERIOR - Desregulados" (abajo)
 *   "Nomina Directos AMBA - Vigencia Agosto 2026"     (arriba)
 *
 * NO soporta "Plan Simple" (producto de precio único, fuera de la matriz):
 * lo detecta y devuelve un error claro.
 *
 * Validado contra las 4 listas de Agosto 2026: 110 / 88 / 118 / 94 filas.
 */

export type ComposicionPremedic =
  | 'individual'
  | 'matrimonio'
  | 'matrimonio_1hijo'
  | 'matrimonio_2hijos'
  | 'matrimonio_3hijos'
  | 'adicional_menor1'
  | 'adicional_menor25'
  | 'recargo_60_64_1'
  | 'recargo_60_64_2'

export interface TarifaRow {
  plan_nombre: string          // "Plan C-100" — se resuelve a plan_id contra prepaga_planes
  zona: 'amba' | 'interior'
  modalidad: 'directo' | 'desregulado'
  composicion: ComposicionPremedic
  edad_titular_min: number | null
  edad_titular_max: number | null
  precio: number
  vigencia_desde: string       // YYYY-MM-01
}

export interface ParseResult {
  vigencia_desde: string
  zona: 'amba' | 'interior'
  modalidad: 'directo' | 'desregulado'
  rows: TarifaRow[]
  warnings: string[]
}

// Bandas de edad del titular (en el orden en que aparecen las columnas del PDF)
const BANDAS: Array<[number, number]> = [
  [1, 29],
  [30, 39],
  [40, 49],
  [50, 59],
]

// Etiqueta del PDF (normalizada) -> composición app. Filas "por banda" (4 precios).
const COMP_BASE: Record<string, ComposicionPremedic> = {
  'individual': 'individual',
  'matrimonio': 'matrimonio',
  'matrimonio + 1 hijo': 'matrimonio_1hijo',
  'matrimonio + 2 hijos': 'matrimonio_2hijos',
  'matrimonio + 3 hijos': 'matrimonio_3hijos',
}
// Adicionales: mismo valor en las 4 columnas => una sola fila sin banda de edad.
const COMP_ADICIONAL: Record<string, ComposicionPremedic> = {
  'adicional menor de 1 ano': 'adicional_menor1',
  'adicional menor de 25 anos': 'adicional_menor25',
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

/** Normaliza: saca acentos y ordinales (º->o), pasa a minúscula, colapsa espacios. */
function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** "$ 1.031.610" | "$ 59,690" -> 1031610 | 59690 (separadores de miles). */
function toInt(raw: string): number {
  return parseInt(raw.replace(/[.,\s]/g, ''), 10)
}

/** "plan c-100" -> "Plan C-100"; "plan 200" -> "Plan 200". */
function planNombre(planlabel: string): string {
  return 'Plan ' + planlabel.replace(/^plan\s+/, '').toUpperCase()
}

export function parseTarifarioPremedic(text: string): ParseResult {
  const warnings: string[] = []
  const t = norm(text)

  // Producto no soportado
  if (t.includes('plan simple')) {
    throw new Error('El PDF es de "Plan Simple" (producto de precio único, fuera de la matriz de tarifas). No se puede cargar acá.')
  }

  // --- Cabecera: mes/año, zona y modalidad detectados por separado ---
  const my = t.match(/vigencia\s+([a-z]+)\s+(\d{4})/)
  if (!my) throw new Error('No se detectó la vigencia ("Vigencia <mes> <año>").')
  const mesNum = MESES[my[1]]
  if (!mesNum) throw new Error(`Mes no reconocido en la vigencia: "${my[1]}".`)
  const vigencia_desde = `${my[2]}-${String(mesNum).padStart(2, '0')}-01`

  const modalidad: 'directo' | 'desregulado' = t.includes('directo') ? 'directo' : 'desregulado'
  const zona: 'amba' | 'interior' = t.includes('interior') ? 'interior' : 'amba'

  // --- Partir en secciones por "detalle" (cada bloque empieza así) ---
  const chunks = t.split(/detalle\s+/).slice(1) // descarta lo previo al 1er "detalle"
  const rows: TarifaRow[] = []

  for (const chunk of chunks) {
    // Encabezado de planes al inicio del chunk: "plan x plan y ..."
    const headMatch = chunk.match(/^((?:plan\s+[\w-]+\s*)+)/)
    if (!headMatch) continue
    const planes = [...headMatch[1].matchAll(/plan\s+([\w-]+)/g)].map(m => m[1])
    const body = chunk.slice(headMatch[1].length)
    const distinct = [...new Set(planes)]

    // Sección de recargos 60-64 (transpuesta: planes como columnas)
    if (/recargo/.test(body)) {
      parseRecargos(planes, body, vigencia_desde, zona, modalidad, rows, warnings)
      continue
    }
    // Sección informativa 65-70 / cotiza central: se ignora (la maneja el cotizador)
    if (/65 a 70|cotiza central/.test(body)) continue

    // Bloque estándar: un plan con su grilla por banda de edad
    if (distinct.length === 1) {
      parseBloqueEstandar(planNombre('plan ' + distinct[0]), body, vigencia_desde, zona, modalidad, rows, warnings)
      continue
    }
    warnings.push(`Sección no reconocida (planes: ${distinct.join(', ')})`)
  }

  if (rows.length === 0) warnings.push('No se extrajo ninguna fila: revisá que el PDF tenga el layout esperado.')

  return { vigencia_desde, zona, modalidad, rows, warnings }
}

function parseBloqueEstandar(
  plan_nombre: string, body: string, vigencia_desde: string,
  zona: 'amba' | 'interior', modalidad: 'directo' | 'desregulado',
  rows: TarifaRow[], warnings: string[]
) {
  for (const [etiqueta, composicion] of Object.entries(COMP_BASE)) {
    const m = body.match(new RegExp(escapeRe(etiqueta) + '((?:\\s*\\$\\s*[\\d.,]+)+)'))
    if (!m) { warnings.push(`${plan_nombre}: falta la fila "${etiqueta}"`); continue }
    const vals = leerImportes(m[1])
    if (vals.length < 4) { warnings.push(`${plan_nombre}/${composicion}: esperaba 4 precios, encontró ${vals.length}`); continue }
    BANDAS.forEach(([emin, emax], i) => {
      rows.push({ plan_nombre, zona, modalidad, composicion, edad_titular_min: emin, edad_titular_max: emax, precio: vals[i], vigencia_desde })
    })
  }
  for (const [etiqueta, composicion] of Object.entries(COMP_ADICIONAL)) {
    const m = body.match(new RegExp(escapeRe(etiqueta) + '((?:\\s*\\$\\s*[\\d.,]+)+)'))
    if (!m) { warnings.push(`${plan_nombre}: falta la fila "${etiqueta}"`); continue }
    const vals = leerImportes(m[1])
    if (new Set(vals).size > 1) warnings.push(`${plan_nombre}/${composicion}: adicional con valores distintos (${[...new Set(vals)].join(', ')}); se toma el primero`)
    rows.push({ plan_nombre, zona, modalidad, composicion, edad_titular_min: null, edad_titular_max: null, precio: vals[0], vigencia_desde })
  }
}

// Recargos 60-64: "1º Recargo de 60 a 64 años $ a $ b $ c ..." (un precio por plan del encabezado)
function parseRecargos(
  planes: string[], body: string, vigencia_desde: string,
  zona: 'amba' | 'interior', modalidad: 'directo' | 'desregulado',
  rows: TarifaRow[], warnings: string[]
) {
  const nombres = planes.map(p => planNombre('plan ' + p))
  const mapa: Array<[RegExp, ComposicionPremedic]> = [
    [/1o?\s*recargo[^$]*?((?:\$\s*[\d.,]+\s*)+)/, 'recargo_60_64_1'],
    [/2o?\s*recargo[^$]*?((?:\$\s*[\d.,]+\s*)+)/, 'recargo_60_64_2'],
  ]
  for (const [re, composicion] of mapa) {
    const m = body.match(re)
    if (!m) { warnings.push(`Falta la fila "${composicion}"`); continue }
    const vals = leerImportes(m[1])
    if (vals.length !== nombres.length) {
      warnings.push(`${composicion}: ${vals.length} precios para ${nombres.length} planes`)
    }
    nombres.forEach((plan_nombre, i) => {
      if (vals[i] === undefined) return
      rows.push({ plan_nombre, zona, modalidad, composicion, edad_titular_min: null, edad_titular_max: null, precio: vals[i], vigencia_desde })
    })
  }
}

function leerImportes(s: string): number[] {
  return [...s.matchAll(/\$\s*([\d.,]+)/g)].map(m => toInt(m[1]))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
