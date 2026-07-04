// Origen del dato de un lead. Define la escala comisional que se aplica
// (prepaga_comision_reglas.origen) y queda snapshoteado en cada comisión.
export type OrigenLead = 'nexo' | 'referido' | 'campania'

export const ORIGEN_LABELS: Record<OrigenLead, string> = {
  nexo: 'Origen Nexo',
  referido: 'Referido',
  campania: 'Campaña',
}

export const ORIGEN_OPTIONS: { value: OrigenLead; label: string }[] = [
  { value: 'nexo', label: 'Origen Nexo (importación)' },
  { value: 'referido', label: 'Referido (carga del asesor)' },
  { value: 'campania', label: 'Campaña' },
]

export const origenLabel = (origen: string | null | undefined) =>
  ORIGEN_LABELS[(origen ?? 'nexo') as OrigenLead] ?? origen ?? 'Origen Nexo'
