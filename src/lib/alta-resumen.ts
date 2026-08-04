// ---------------------------------------------------------------------------
// Generador del "resumen del trámite" que se envía a procesar a la prepaga.
// El formato varía por prepaga; hoy está definido Sancor Salud (piloto) y hay
// un formato genérico de fallback para el resto.
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

// --- Helpers de formato -----------------------------------------------------

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
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

  // Titular
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

  // Grupo familiar
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

// --- Genérico (resto de prepagas) ------------------------------------------

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

// --- Dispatcher por prepaga -------------------------------------------------

export function generarResumenTexto(
  alta: ResumenAlta,
  integrantes: ResumenIntegrante[]
): string {
  switch (alta.prepagaSlug) {
    case 'sancor-salud':
      return resumenSancor(alta, integrantes)
    default:
      return resumenGenerico(alta, integrantes)
  }
}
