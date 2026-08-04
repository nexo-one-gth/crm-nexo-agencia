'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, ClipboardList } from 'lucide-react'
import { completarItem } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type ItemDato = {
  id: string
  etiqueta: string
  tipo_dato: string
  requerido: boolean
  completado: boolean
  valor_texto: string | null
  valor_fecha: string | null
  valor_numero: number | null
}

interface DatosEspecificosProps {
  altaId: string
  prepagaNombre: string
  items: ItemDato[]
}

function CampoDato({ item, altaId }: { item: ItemDato; altaId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [valor, setValor] = useState<string>(
    item.valor_texto ?? item.valor_fecha ?? (item.valor_numero != null ? String(item.valor_numero) : '')
  )

  function guardar() {
    startTransition(async () => {
      const res = await completarItem({
        item_id: item.id,
        completado: valor.trim().length > 0,
        valor_texto: item.tipo_dato === 'texto' ? (valor || undefined) : undefined,
        valor_fecha: item.tipo_dato === 'fecha' ? (valor || undefined) : undefined,
        valor_numero: item.tipo_dato === 'numero' && valor ? Number(valor) : undefined,
      })
      if (res?.error) { toast.error(res.error); return }
      router.refresh()
    })
  }

  const inputType =
    item.tipo_dato === 'fecha' ? 'date' :
    item.tipo_dato === 'numero' ? 'number' : 'text'

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {item.etiqueta}
        {item.requerido && <span className="text-rose-500 font-bold">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={inputType}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onBlur={guardar}
          onKeyDown={e => e.key === 'Enter' && guardar()}
          disabled={isPending}
          className={cn(
            'flex-1 text-sm px-3 py-2 rounded-xl border transition-colors',
            'bg-white dark:bg-slate-800 text-slate-900 dark:text-white',
            'border-slate-200 dark:border-white/10',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400',
            'disabled:opacity-50',
            item.completado && valor
              ? 'border-emerald-300 dark:border-emerald-600/40'
              : ''
          )}
          placeholder={`Ingresar ${item.etiqueta.toLowerCase()}…`}
        />
        {isPending && (
          <Save className="w-4 h-4 text-slate-400 animate-pulse shrink-0" />
        )}
      </div>
    </div>
  )
}

export function DatosEspecificos({ altaId, prepagaNombre, items }: DatosEspecificosProps) {
  if (items.length === 0) return null

  const requeridos = items.filter(i => i.requerido)
  const opcionales = items.filter(i => !i.requerido)
  const completados = items.filter(i => i.completado).length

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-violet-500" />
          Datos específicos — {prepagaNombre}
        </h2>
        <span className="text-xs text-slate-400">
          {completados}/{items.length} completados
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {requeridos.map(item => (
          <CampoDato key={item.id} item={item} altaId={altaId} />
        ))}
        {opcionales.map(item => (
          <CampoDato key={item.id} item={item} altaId={altaId} />
        ))}
      </div>
    </section>
  )
}
