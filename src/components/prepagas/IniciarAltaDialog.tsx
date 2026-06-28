'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileText, X } from 'lucide-react'
import { iniciarAlta, getPlanesPorPrepaga } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'

interface IniciarAltaDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  leadNombre: string
  prepagaId: string
  prepagaNombre: string
}

const TIPOS_ALTA = ['particular', 'relacion_dependencia', 'monotributo', 'pmo']

export function IniciarAltaDialog({
  isOpen,
  onClose,
  leadId,
  leadNombre,
  prepagaId,
  prepagaNombre,
}: IniciarAltaDialogProps) {
  const router = useRouter()
  const [tipoAlta, setTipoAlta] = useState('')
  const [planId, setPlanId] = useState('')
  const [planes, setPlanes] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && prepagaId) {
      getPlanesPorPrepaga(prepagaId).then(setPlanes)
    }
  }, [isOpen, prepagaId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await iniciarAlta({
      lead_id: leadId,
      prepaga_id: prepagaId,
      plan_id: planId || undefined,
      tipo_alta: tipoAlta || undefined,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Alta iniciada correctamente')
    onClose()
    router.push(`/altas/${result.data?.id}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Iniciar alta</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Prospecto</p>
            <p className="font-semibold text-slate-900 dark:text-white">{leadNombre}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Prepaga</p>
            <p className="font-semibold text-slate-900 dark:text-white">{prepagaNombre}</p>
          </div>

          {planes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Plan (opcional)
              </label>
              <select
                value={planId}
                onChange={e => setPlanId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Sin plan específico</option>
                {planes.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tipo de alta (opcional)
            </label>
            <select
              value={tipoAlta}
              onChange={e => setTipoAlta(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Estándar</option>
              {TIPOS_ALTA.map(t => (
                <option key={t} value={t}>
                  {t === 'particular' ? 'Particular' :
                   t === 'relacion_dependencia' ? 'Relación de dependencia' :
                   t === 'monotributo' ? 'Monotributo' :
                   'PMO / Aportes (afinidad)'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Iniciando...' : 'Iniciar alta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
