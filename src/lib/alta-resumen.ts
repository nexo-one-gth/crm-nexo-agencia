// ---------------------------------------------------------------------------
// Generador del "resumen del trámite" que se envía a procesar a la prepaga.
// El formato puede ser:
//   a) Plantilla configurable por prepaga (resumen_template con {{variables}})
//   b) Formato específico hardcodeado (Sancor Salud — legado)
//   c) Formato genérico de fallback
// ---------------------------------------------------------------------------

export type ResumenIntegrante = {
  rol: string // titular | conyuge | hijo | adherente
  orden: number
  nombre: string | null
  dni: string | null
  cuil: string | null
  fecha_nac: string | null
  edad: number | null
  peso_kg: number | null
  altura_cm: number | null
  domicilio: string | null
  telefono: string | null
  email: string | null
  parentesco: string | null
}

export type ResumenAlta = {
  prepagaNombre: string
  prepagaSlug: string
  planNombre: string | null
  planCodigo: string | null
  condicion: string | null
  cantidadCapitas: number | null
  cuota: number | null
  aportesPromedio: number | null
  sueldoBruto: number | null
  periodoAportes: string | null
}

export type DatoItem = {
  etiqueta: string
  valor_texto: string | null
  valor_numero: number | null
  valor_fecha: string | null
}

// --- Helpers de formato -----------------------------------------------------

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  // minimumFractionDigits: los documentos de la prepaga escriben los importes
  // siempre con dos decimales ("$1.414.841,00"). Sin esto el sueldo bruto salía
  // "$1.414.841" y no coincidía con el recibo.
  return '$' + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fecha(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function labelRol(rol: string, indice: number): string {
  switch (rol) {
    case 'titular': return 'Datos TITULAR'
    case 'conyuge': return 'Datos CÓNYUGE'
    case 'hijo': return `Datos HIJO ${indice}`
    case 'adherente': return `Datos ADHERENTE ${indice}`
    default: return `Datos ${rol.toUpperCase()} ${indice}`
  }
}

const SEP = '-'.repeat(40)

// Bloque de texto con los integrantes no-titular, en el formato que la agencia
// ya usaba a mano. Devuelve '' si el trámite es de una sola cápita, para que el
// template no quede con un separador colgado.
function bloqueIntegrantes(otros: ResumenIntegrante[]): string {
  if (otros.length === 0) return ''
  const L: string[] = []
  const contadores: Record<string, number> = {}
  for (const integ of otros) {
    contadores[integ.rol] = (contadores[integ.rol] ?? 0) + 1
    L.push(SEP)
    L.push(labelRol(integ.rol, contadores[integ.rol]))
    L.push(`Nombre: ${(integ.nombre ?? '-').toUpperCase()}`)
    if (integ.edad != null) L.push(`Edad: ${integ.edad}`)
    if (integ.fecha_nac) L.push(`Fecha de Nacimiento: ${fecha(integ.fecha_nac)}`)
    L.push(`DNI: ${integ.dni ?? '-'}`)
    L.push(`Cuil: ${integ.cuil ?? '-'}`)
    if (integ.peso_kg != null) L.push(`Peso: ${integ.peso_kg} KG`)
    if (integ.altura_cm != null) L.push(`Altura: ${integ.altura_cm} CM`)
  }
  return L.join('\n')
}

// --- Motor de plantilla con interpolación {{variable}} ----------------------

function buildVars(
  alta: ResumenAlta,
  integrantes: ResumenIntegrante[],
  datosItems: DatoItem[]
): Record<string, string> {
  const titular = integrantes.find(i => i.rol === 'titular')
  const otros = integrantes.filter(i => i.rol !== 'titular').sort((a, b) => a.orden - b.orden)

  const vars: Record<string, string> = {
    prepaga:        alta.prepagaNombre ?? '',
    plan_nombre:    alta.planNombre ?? '',
    plan_codigo:    alta.planCodigo ?? alta.planNombre ?? '',
    condicion:      alta.condicion ?? '',
    cuota:          money(alta.cuota),
    capitas:        alta.cantidadCapitas?.toString() ?? '',
    aportes:        money(alta.aportesPromedio),
    sueldo_bruto:   money(alta.sueldoBruto),
    periodo:        alta.periodoAportes ?? '',

    titular_nombre:    (titular?.nombre ?? '').toUpperCase(),
    titular_dni:       titular?.dni ?? '',
    titular_cuil:      titular?.cuil ?? '',
    titular_edad:      titular?.edad?.toString() ?? '',
    titular_peso:      titular?.peso_kg?.toString() ?? '',
    titular_altura:    titular?.altura_cm?.toString() ?? '',
    titular_domicilio: titular?.domicilio ?? '',
    titular_tel:       titular?.telefono ?? '',
    titular_email:     titular?.email ?? '',
    titular_fecha_nac: fecha(titular?.fecha_nac ?? null),

    // El motor de templates no tiene bucles y la cantidad de integrantes es
    // variable. `{{integrantes}}` resuelve el grupo familiar entero en una
    // variable; las claves numeradas de abajo siguen disponibles para un
    // template que quiera maquetar un integrante puntual.
    integrantes: bloqueIntegrantes(otros),
  }

  // Integrantes no-titular: integrante_2_nombre, integrante_3_dni, etc.
  otros.forEach((integ, idx) => {
    const n = idx + 2 // empieza en 2
    vars[`integrante_${n}_nombre`]    = (integ.nombre ?? '').toUpperCase()
    vars[`integrante_${n}_dni`]       = integ.dni ?? ''
    vars[`integrante_${n}_cuil`]      = integ.cuil ?? ''
    vars[`integrante_${n}_edad`]      = integ.edad?.toString() ?? ''
    vars[`integrante_${n}_fecha_nac`] = fecha(integ.fecha_nac ?? null)
    vars[`integrante_${n}_rol`]       = integ.rol.toUpperCase()
  })

  // Datos específicos de la prepaga → clave: datos.<etiqueta_normalizada>
  for (const item of datosItems) {
    // NFD + strip de diacríticos: sin esto "Código postal" produce la clave
    // `codigo_postal` sin la o acentuada -> `cdigo_postal`, y el template falla
    // en silencio (interpolar() reemplaza por '' lo que no encuentra).
    const clave = 'datos.' + item.etiqueta
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.]/g, '')
    // valor_fecha pasa por fecha(): sin esto un ítem de tipo `fecha` se
    // interpolaba como '2026-09-01' en un resumen donde todo lo demás va
    // dd/mm/aaaa.
    vars[clave] =
      item.valor_texto ??
      item.valor_numero?.toString() ??
      (item.valor_fecha ? fecha(item.valor_fecha) : '')
  }

  return vars
}

function interpolar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => vars[key.trim()] ?? '')
}

// --- Sancor Salud -----------------------------------------------------------

function resumenSancor(alta: ResumenAlta, integrantes: ResumenIntegrante[]): string {
  const titular = integrantes.find(i => i.rol === 'titular')
  const otros = integrantes.filter(i => i.rol !== 'titular').sort((a, b) => a.orden - b.orden)

  const L: string[] = []
  L.push('PREPAGA SANCOR SALUD')
  if (alta.planCodigo || alta.planNombre) {
    L.push(`PLAN  ${alta.planCodigo ?? alta.planNombre}`)
  }
  if (alta.condicion) L.push(alta.condicion.toUpperCase())
  if (alta.cantidadCapitas) L.push(`${alta.cantidadCapitas} CÁPITAS`)
  if (alta.cuota != null) L.push(`💙Cuota ${money(alta.cuota)}`)
  L.push('')
  L.push(SEP)
  if (alta.aportesPromedio != null || alta.periodoAportes) {
    L.push(
      `✅ Monto aprox. de Aportes promedio${alta.periodoAportes ? ` calculados sobre el mes de ${alta.periodoAportes.toUpperCase()}` : ''}`
    )
    L.push(
      `👉 ${money(alta.aportesPromedio)}${alta.sueldoBruto != null ? ` (SUELDO BRUTO ${money(alta.sueldoBruto)})` : ''}`
    )
  }
  L.push('')

  if (titular) {
    L.push(labelRol('titular', 1))
    L.push(`Nombre: ${(titular.nombre ?? '—').toUpperCase()}`)
    L.push(`DNI: ${titular.dni ?? '—'}`)
    L.push(`Cuil: ${titular.cuil ?? '—'}`)
    if (titular.edad != null) L.push(`Edad: ${titular.edad} AÑOS`)
    if (titular.peso_kg != null) L.push(`Peso: ${titular.peso_kg} KG`)
    if (titular.altura_cm != null) L.push(`Altura: ${titular.altura_cm} CM`)
    if (titular.domicilio) L.push(`Domicilio: ${titular.domicilio.toUpperCase()}`)
    if (titular.telefono) L.push(`Tel: ${titular.telefono}`)
    if (titular.email) L.push(`Email: ${titular.email.toUpperCase()}`)
  }

  const contadores: Record<string, number> = {}
  for (const integ of otros) {
    contadores[integ.rol] = (contadores[integ.rol] ?? 0) + 1
    L.push('-'.repeat(60))
    L.push(labelRol(integ.rol, contadores[integ.rol]))
    L.push(`•Nombre: ${(integ.nombre ?? '—').toUpperCase()}`)
    if (integ.edad != null) L.push(`•Edad: ${integ.edad} AÑOS`)
    if (integ.fecha_nac) L.push(`•Fecha de Nacimiento: ${fecha(integ.fecha_nac)}`)
    L.push(`•DNI: ${integ.dni ?? '—'}`)
    L.push(`•Cuil: ${integ.cuil ?? '—'}`)
  }

  return L.join('\n')
}

// --- Genérico (resto de prepagas sin template configurado) ------------------

function resumenGenerico(alta: ResumenAlta, integrantes: ResumenIntegrante[]): string {
  const titular = integrantes.find(i => i.rol === 'titular')
  const otros = integrantes.filter(i => i.rol !== 'titular').sort((a, b) => a.orden - b.orden)

  const L: string[] = []
  L.push(`PREPAGA ${alta.prepagaNombre.toUpperCase()}`)
  if (alta.planCodigo || alta.planNombre) L.push(`PLAN  ${alta.planCodigo ?? alta.planNombre}`)
  if (alta.condicion) L.push(alta.condicion.toUpperCase())
  if (alta.cantidadCapitas) L.push(`${alta.cantidadCapitas} CÁPITAS`)
  if (alta.cuota != null) L.push(`Cuota ${money(alta.cuota)}`)
  if (alta.aportesPromedio != null) {
    L.push(
      `Aportes promedio${alta.periodoAportes ? ` (${alta.periodoAportes})` : ''}: ${money(alta.aportesPromedio)}` +
      (alta.sueldoBruto != null ? ` — Sueldo bruto ${money(alta.sueldoBruto)}` : '')
    )
  }
  L.push('')

  if (titular) {
    L.push(labelRol('titular', 1))
    L.push(`Nombre: ${(titular.nombre ?? '—').toUpperCase()}`)
    L.push(`DNI: ${titular.dni ?? '—'}`)
    L.push(`Cuil: ${titular.cuil ?? '—'}`)
    if (titular.edad != null) L.push(`Edad: ${titular.edad} AÑOS`)
    if (titular.peso_kg != null) L.push(`Peso: ${titular.peso_kg} KG`)
    if (titular.altura_cm != null) L.push(`Altura: ${titular.altura_cm} CM`)
    if (titular.domicilio) L.push(`Domicilio: ${titular.domicilio.toUpperCase()}`)
    if (titular.telefono) L.push(`Tel: ${titular.telefono}`)
    if (titular.email) L.push(`Email: ${titular.email.toUpperCase()}`)
  }

  const contadores: Record<string, number> = {}
  for (const integ of otros) {
    contadores[integ.rol] = (contadores[integ.rol] ?? 0) + 1
    L.push(SEP)
    L.push(labelRol(integ.rol, contadores[integ.rol]))
    L.push(`•Nombre: ${(integ.nombre ?? '—').toUpperCase()}`)
    if (integ.edad != null) L.push(`•Edad: ${integ.edad} AÑOS`)
    if (integ.fecha_nac) L.push(`•Fecha de Nacimiento: ${fecha(integ.fecha_nac)}`)
    L.push(`•DNI: ${integ.dni ?? '—'}`)
    L.push(`•Cuil: ${integ.cuil ?? '—'}`)
  }

  return L.join('\n')
}

// --- Dispatcher principal ---------------------------------------------------

export function generarResumenTexto(
  alta: ResumenAlta,
  integrantes: ResumenIntegrante[],
  datosItems: DatoItem[] = [],
  resumenTemplate?: string | null
): string {
  // Template configurable desde admin: tiene prioridad sobre todo
  if (resumenTemplate) {
    return interpolar(resumenTemplate, buildVars(alta, integrantes, datosItems))
  }
  // Formato hardcodeado por slug (legado — reemplazar con templates configurados)
  switch (alta.prepagaSlug) {
    case 'sancor-salud':
      return resumenSancor(alta, integrantes)
    default:
      return resumenGenerico(alta, integrantes)
  }
}
