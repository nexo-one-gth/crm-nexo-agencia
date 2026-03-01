/**
 * Campos considerados para el cálculo de completación de un lead.
 */
export const COMPLETION_FIELDS = [
    'first_name',
    'last_name',
    'phone',
    'email',
    'dni',
    'cuil',
    'cuit_empleador',
    'numero_tramite',
    'address_state',
    'address_city',
    'obra_social',
    'cantidad_integrantes',
    'edades',
    'plan',
    'valor_plan',
    'valor_final_socio',
    'valor_forecast'
] as const

/**
 * Calcula el porcentaje de completación de un lead.
 * @param lead El objeto lead a evaluar.
 * @returns Un número entre 0 y 100 representing el porcentaje de completación.
 */
export const calculateLeadCompletion = (lead: any): number => {
    if (!lead) return 0

    let completedCount = 0

    COMPLETION_FIELDS.forEach(field => {
        const value = lead[field]
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'number' && value > 0) {
                completedCount++
            } else if (typeof value === 'string' && value.trim().length > 0) {
                completedCount++
            }
        }
    })

    return Math.round((completedCount / COMPLETION_FIELDS.length) * 100)
}

/**
 * Determina el color del indicador de completación basado en el porcentaje.
 */
export const getCompletionColor = (percentage: number) => {
    if (percentage < 30) return 'text-rose-500 bg-rose-500/10'
    if (percentage < 70) return 'text-amber-500 bg-amber-500/10'
    if (percentage < 100) return 'text-blue-500 bg-blue-500/10'
    return 'text-green-500 bg-green-500/10'
}
