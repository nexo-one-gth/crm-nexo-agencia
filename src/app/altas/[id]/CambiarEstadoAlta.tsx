'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { actualizarEstadoAlta } from '@/app/actions/prepaga-actions'
import type { EstadoAlta } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'
import { ArrowRight, AlertCircle, Send } from 'lucide-react'

const TRANSICIONES: Record<string, EstadoAlta[]> = {
  en_proceso: ['enviada'],
  enviada:    ['observada', 'aprobada', 'rechazada'],
  observada:  ['enviada', 'rechazada'],
  aprobada:   [],
  rechazada:  [],
}

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  enviada:    'Enviar a procesar',
  observada:  'Marcar con observaciones',
  aprobada:   'Marcar como aprobada',
  rechazada:  'Rechazar',
}

const ESTADO_COLORS: Record<string, string> = {
  enviada:  'bg-blue-600 hover:bg-blue-700',
  aprobada: 'bg-emerald-600 hover:bg-emerald-700',
  observada:'bg-orange-500 hover:bg-orange-600',
  rechazada:'bg-rose-600 hover:bg-rose-700',
}

interface Props {
  altaId: string
  estadoActual: EstadoAlta
  observaciones: string | null
  isAdmin: boolean
  /** Lo que le falta al trámite para poder enviarse. Calculado en el server. */
  faltantes: string[]
}

// Aprobar/rechazar es una decisión de venta que le corresponde al admin, no al
// asesor que la vendió — el asesor solo puede enviar la documentación.
const TRANSICIONES_ADMIN_ONLY: EstadoAlta[] = ['aprobada', 'rechazada']

export function CambiarEstadoAlta({ altaId, estadoActual, observaciones, isAdmin, faltantes }: Props) {
  const [isPending, startTransition] = useTransition()
  const [obs, setObs] = useState(observaciones ?? '')
  const router = useRouter()

  const siguientes = (TRANSICIONES[estadoActual] ?? []).filter(
    estado => isAdmin || !TRANSICIONES_ADMIN_ONLY.includes(estado)
  )
  if (siguientes.length === 0) return null

  // El asesor no puede enviar un trámite incompleto. El admin sí puede forzar:
  // mismo criterio que el trigger `altas_guard_estado` en la base.
  const bloqueaEnvio = faltantes.length > 0 && !isAdmin

  function handleCambiar(estado: EstadoAlta) {
    startTransition(async () => {
      const res = await actualizarEstadoAlta(altaId, estado, obs || undefined)
      if (res.error) { toast.error(res.error); return }
      toast.success(`Alta marcada como: ${ESTADO_LABELS[estado] ?? estado}`)
      router.refresh()
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <ArrowRight className="w-4 h-4 text-blue-500" />
        Avanzar estado
      </h2>

      {(estadoActual === 'enviada' || estadoActual === 'observada') && (
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Observaciones (opcional)
          </label>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={2}
            placeholder="Notas sobre el estado..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {faltantes.length > 0 && siguientes.includes('enviada') && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {isAdmin
              ? `El trámite está incompleto (${faltantes.length}). Podés enviarlo igual, pero la prepaga lo va a observar.`
              : `Falta esto para enviar a procesar (${faltantes.length})`}
          </p>
          <ul className="space-y-1">
            {faltantes.map(f => (
              <li key={f} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {siguientes.map(estado => {
          const deshabilitado = isPending || (estado === 'enviada' && bloqueaEnvio)
          return (
            <button
              key={estado}
              onClick={() => handleCambiar(estado)}
              disabled={deshabilitado}
              title={estado === 'enviada' && bloqueaEnvio ? 'Completá los ítems pendientes' : undefined}
              className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ${ESTADO_COLORS[estado] ?? 'bg-slate-600 hover:bg-slate-700'}`}
            >
              {estado === 'enviada' && <Send className="w-3.5 h-3.5" />}
              {ESTADO_LABELS[estado]}
            </button>
          )
        })}
      </div>
    </section>
  )
}
