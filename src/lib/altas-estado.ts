import type { EstadoAlta } from '@/app/actions/prepaga-actions'

// Única fuente de verdad para el badge visual (label + color) de un estado de
// alta. Antes vivía duplicado en altas/page.tsx y altas/[id]/page.tsx — si
// mañana se agrega un estado o cambia un color, alcanza con tocar acá.
//
// No confundir con ESTADO_LABELS/ESTADO_COLORS de CambiarEstadoAlta.tsx: eso
// describe el verbo del botón que dispara la transición ("Marcar como
// aprobada"), esto describe el estado ya alcanzado, en pasado ("Aprobada").
export const ESTADO_ALTA_BADGE: Record<EstadoAlta, { label: string; color: string }> = {
  en_proceso: { label: 'En proceso', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  enviada:    { label: 'Enviada',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  observada:  { label: 'Observada',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  aprobada:   { label: 'Aprobada',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rechazada:  { label: 'Rechazada',  color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

// alta.estado llega de Supabase como string plano (no acotado al literal
// union en tiempo de compilación) — este helper hace el fallback seguro que
// antes se repetía como `ESTADO_BADGE[alta.estado] ?? ESTADO_BADGE.en_proceso`
// en cada archivo.
export function getEstadoAltaBadge(estado: string): { label: string; color: string } {
  return ESTADO_ALTA_BADGE[estado as EstadoAlta] ?? ESTADO_ALTA_BADGE.en_proceso
}
