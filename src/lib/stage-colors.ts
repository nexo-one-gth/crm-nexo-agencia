/**
 * Fuente única de verdad para el color de cada etapa del embudo.
 * Antes había 3 mapas de color distintos (LeadCard, PIPELINE_STAGES, LeadFunnelBoard.STAGES)
 * que no coincidían entre sí (ej: "Contactado" era azul en una columna y ámbar en la card).
 * Cualquier componente que pinte una etapa debe leer de aquí.
 */
export type StageColorKey =
    | 'Pendiente de Asignación'
    | 'Pendiente'
    | 'Contactado'
    | 'Interesado'
    | 'Cotizado'
    | 'Alta en Proceso'
    | 'Ganado'
    | 'No Interesado'

interface StageColor {
    /** Gradiente para bandas laterales / dots */
    gradient: string
    /** Color sólido para botones de avance de etapa */
    solid: string
    /** Color de texto para headers de columna / iconos */
    text: string
    /** Fondo translúcido para headers de columna / badges */
    bg: string
    /** Color de borde para tabs activos */
    border: string
}

export const STAGE_COLORS: Record<StageColorKey, StageColor> = {
    'Pendiente de Asignación': {
        gradient: 'from-slate-600 to-slate-400',
        solid: 'bg-slate-500',
        text: 'text-slate-500',
        bg: 'bg-slate-500/10',
        border: 'border-slate-400',
    },
    Pendiente: {
        gradient: 'from-amber-600 to-amber-400',
        solid: 'bg-amber-500',
        text: 'text-amber-500',
        bg: 'bg-amber-500/10',
        border: 'border-amber-400',
    },
    Contactado: {
        gradient: 'from-blue-600 to-blue-400',
        solid: 'bg-blue-500',
        text: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-400',
    },
    Interesado: {
        gradient: 'from-indigo-600 to-indigo-400',
        solid: 'bg-indigo-500',
        text: 'text-indigo-500',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-400',
    },
    Cotizado: {
        gradient: 'from-emerald-600 to-emerald-400',
        solid: 'bg-emerald-500',
        text: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-400',
    },
    'Alta en Proceso': {
        gradient: 'from-purple-600 to-purple-400',
        solid: 'bg-purple-500',
        text: 'text-purple-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-400',
    },
    Ganado: {
        gradient: 'from-green-600 to-green-400',
        solid: 'bg-green-500',
        text: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-400',
    },
    'No Interesado': {
        gradient: 'from-slate-600 to-slate-400',
        solid: 'bg-slate-500',
        text: 'text-slate-500',
        bg: 'bg-slate-500/10',
        border: 'border-slate-400',
    },
}

export const getStageColor = (stage: string): StageColor =>
    STAGE_COLORS[stage as StageColorKey] ?? STAGE_COLORS['No Interesado']
