/**
 * Motivos de descarte — fuente única de verdad.
 *
 * Antes esta lista vivía duplicada en tres lugares (el menú de LeadCard y los dos
 * <select> de filtro de LeadFunnelBoard, mobile y desktop). Cuando se agregaba un
 * motivo en el menú y no en los filtros, los leads descartados con ese motivo
 * quedaban invisibles en la columna "No Interesado": el filtro no los podía
 * seleccionar. Todo consumidor nuevo debe leer de acá.
 *
 * `discard_reason` en Postgres es TEXT libre (sin CHECK), así que agregar un motivo
 * NO requiere migración. La contra es que nada a nivel DB impide que entre un valor
 * fuera de esta lista: la consistencia depende de que la UI use estas constantes.
 */

export type DiscardReasonGroupKey = 'dato_invalido' | 'no_califica'

export interface DiscardReasonOption {
    /** Valor que se persiste en leads.discard_reason. No cambiar sin migrar los datos existentes. */
    value: string
    /** Etiqueta corta para el <select> de filtro, donde el ancho es escaso. */
    shortLabel: string
    group: DiscardReasonGroupKey
}

export const DISCARD_REASONS: readonly DiscardReasonOption[] = [
    // Dato inválido: el lead no es contactable o no debería contar como oportunidad real.
    { value: 'No responde', shortLabel: 'No responde', group: 'dato_invalido' },
    { value: 'Número inexistente', shortLabel: 'Nº inexistente', group: 'dato_invalido' },
    { value: 'Duplicado', shortLabel: 'Duplicado', group: 'dato_invalido' },
    // No califica: el contacto es real pero la venta no procede.
    { value: 'Preexistencia', shortLabel: 'Preexistencia', group: 'no_califica' },
    { value: 'Embarazo en curso', shortLabel: 'Embarazo', group: 'no_califica' },
    { value: 'Rango de edad incorrecto', shortLabel: 'Rango de edad', group: 'no_califica' },
    { value: 'Solo consulta', shortLabel: 'Solo consulta', group: 'no_califica' },
] as const

export const DISCARD_REASON_GROUP_LABELS: Record<DiscardReasonGroupKey, string> = {
    dato_invalido: 'Dato inválido',
    no_califica: 'No califica',
}

/** Orden de los grupos en el menú. Los "dato inválido" van arriba: son los descartes más frecuentes. */
export const DISCARD_REASON_GROUP_ORDER: readonly DiscardReasonGroupKey[] = ['dato_invalido', 'no_califica'] as const

/** Motivos agrupados y en orden, listo para renderizar el menú con separadores. */
export const DISCARD_REASON_GROUPS = DISCARD_REASON_GROUP_ORDER.map(group => ({
    key: group,
    label: DISCARD_REASON_GROUP_LABELS[group],
    reasons: DISCARD_REASONS.filter(r => r.group === group),
}))

/**
 * Motivos que representan higiene de base y no una oportunidad realmente perdida
 * (un duplicado o un teléfono falso nunca fue un lead vendible).
 *
 * PENDIENTE: hoy no se usa. Cuando se revise el dashboard, estos descartes deberían
 * salir del denominador de la tasa de conversión — si no, inflan la base y bajan el
 * porcentaje de conversión de forma artificial.
 */
export const DISCARD_REASONS_HIGIENE_BASE: readonly string[] = DISCARD_REASONS
    .filter(r => r.value === 'Duplicado' || r.value === 'Número inexistente')
    .map(r => r.value)
