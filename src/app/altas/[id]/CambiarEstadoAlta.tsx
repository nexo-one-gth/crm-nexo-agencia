'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { actualizarEstadoAlta } from '@/app/actions/prepaga-actions'
import type { EstadoAlta } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

const TRANSICIONES: Record<string, EstadoAlta[]> = {
  en_proceso: ['enviada'],
  enviada:    ['observada', 'aprobada', 'rechazada'],
  observada:  ['enviada', 'rechazada'],
  aprobada:   [],
  rechazada:  [],
}

const ESTADO_LABELS: Record<string, string> = {
  en_proceso: 'En proceso',
  enviada:    'Marcar como enviada',
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
}

// Aprobar/rechazar es una decisión de venta que le corresponde al admin, no al
// asesor que la vendió — el asesor solo puede enviar la documentación.
const TRANSICIONES_ADMIN_ONLY: EstadoAlta[] = ['aprobada', 'rechazada']

export function CambiarEstadoAlta({ altaId, estadoActual, observaciones, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition()
  const [obs, setObs] = useState(observaciones ?? '')
  const router = useRouter()

  const siguientes = (TRANSICIONES[estadoActual] ?? []).filter(
    estado => isAdmin || !TRANSICIONES_ADMIN_ONLY.includes(estado)
  )
  if (siguientes.length === 0) return null

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

      <div className="flex flex-wrap gap-2">
        {siguientes.map(estado => (
          <button
            key={estado}
            onClick={() => handleCambiar(estado)}
            disabled={isPending}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-50 ${ESTADO_COLORS[estado] ?? 'bg-slate-600 hover:bg-slate-700'}`}
          >
            {ESTADO_LABELS[estado]}
          </button>
        ))}
      </div>
    </section>
  )
}
