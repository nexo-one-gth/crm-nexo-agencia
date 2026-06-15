'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { crearPlan, eliminarPlan } from '@/app/actions/prepaga-actions'
import { Plus, X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Plan = { id: string; nombre: string; descripcion: string | null }

interface Props {
  prepagaId: string
  planesIniciales: Plan[]
}

export function PlanesAdminSection({ prepagaId, planesIniciales }: Props) {
  const router = useRouter()
  const [planes, setPlanes] = useState<Plan[]>(planesIniciales)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await crearPlan({
        prepaga_id: prepagaId,
        nombre,
        descripcion: descripcion || undefined,
        orden: planes.length + 1,
      })
      if (res.error) { toast.error(res.error); return }
      if (res.data) {
        setPlanes(prev => [...prev, { id: res.data!.id, nombre: res.data!.nombre, descripcion: res.data!.descripcion ?? null }])
      }
      setNombre('')
      setDescripcion('')
      toast.success('Plan agregado')
      router.refresh()
    })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarPlan(id)
      if (res.error) { toast.error(res.error); return }
      setPlanes(prev => prev.filter(p => p.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 mt-1">
      {planes.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-3">Sin planes cargados</p>
      )}

      {planes.map(plan => (
        <div key={plan.id} className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 group">
          <div>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{plan.nombre}</p>
            {plan.descripcion && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{plan.descripcion}</p>
            )}
          </div>
          <button
            onClick={() => handleEliminar(plan.id)}
            disabled={isPending}
            className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
            title="Eliminar plan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <form onSubmit={handleCrear} className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
        <input
          required
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre del plan"
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Descripción (opcional)"
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
        </button>
      </form>
    </div>
  )
}
