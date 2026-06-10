'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Square, Upload, Calendar, Hash, Type, FileText } from 'lucide-react'
import { completarItem, subirAdjunto } from '@/app/actions/prepaga-actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Item = {
  id: string
  etiqueta: string
  tipo_dato: string
  requerido: boolean
  completado: boolean
  valor_texto: string | null
  valor_fecha: string | null
  valor_numero: number | null
  archivo_path: string | null
}

interface ChecklistInteractivoProps {
  altaId: string
  items: Item[]
}

const TIPO_ICONO: Record<string, React.ElementType> = {
  check: Check,
  texto: Type,
  archivo: Upload,
  fecha: Calendar,
  numero: Hash,
}

function ItemRow({ item, altaId, onUpdate }: { item: Item; altaId: string; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [valor, setValor] = useState(item.valor_texto ?? item.valor_fecha ?? String(item.valor_numero ?? ''))
  const [editando, setEditando] = useState(false)
  const router = useRouter()
  const Icono = TIPO_ICONO[item.tipo_dato] ?? FileText

  async function toggleCheck() {
    startTransition(async () => {
      const res = await completarItem({ item_id: item.id, completado: !item.completado })
      if (res.error) { toast.error(res.error); return }
      router.refresh()
      onUpdate()
    })
  }

  async function guardarValor() {
    startTransition(async () => {
      const res = await completarItem({
        item_id: item.id,
        completado: valor.trim().length > 0,
        valor_texto: item.tipo_dato === 'texto' ? valor : undefined,
        valor_fecha: item.tipo_dato === 'fecha' ? valor : undefined,
        valor_numero: item.tipo_dato === 'numero' ? Number(valor) : undefined,
      })
      if (res.error) { toast.error(res.error); return }
      setEditando(false)
      router.refresh()
      onUpdate()
    })
  }

  async function subirArchivo(file: File) {
    const supabase = createClient()
    const path = `${altaId}/${item.id}/${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('altas-adjuntos')
      .upload(path, file, { upsert: true })
    if (uploadError) { toast.error('Error al subir el archivo'); return }

    const res = await subirAdjunto({ alta_id: altaId, item_id: item.id, archivo_path: path })
    if (res.error) { toast.error(res.error); return }
    toast.success('Archivo subido')
    router.refresh()
    onUpdate()
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl transition-colors',
      item.completado
        ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
        : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/8',
    )}>
      {/* Toggle check (para tipo 'check' o acción de completar) */}
      <button
        onClick={item.tipo_dato === 'check' ? toggleCheck : undefined}
        disabled={isPending || item.tipo_dato !== 'check'}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
          item.completado
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-slate-300 dark:border-slate-600',
          item.tipo_dato === 'check' && !isPending && 'cursor-pointer hover:border-emerald-400',
        )}
      >
        {item.completado && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icono className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={cn(
            'text-sm font-medium',
            item.completado ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200',
          )}>
            {item.etiqueta}
          </span>
          {item.requerido && (
            <span className="text-xs text-rose-500 font-bold">*</span>
          )}
        </div>

        {/* Campos de valor */}
        {item.tipo_dato !== 'check' && (
          <div className="mt-2">
            {item.tipo_dato === 'archivo' ? (
              <div className="flex items-center gap-2">
                {item.archivo_path ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Archivo subido
                  </span>
                ) : (
                  <label className="cursor-pointer">
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5">
                      <Upload className="w-3 h-3" />
                      Subir archivo
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && subirArchivo(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            ) : editando ? (
              <div className="flex items-center gap-2">
                <input
                  type={item.tipo_dato === 'fecha' ? 'date' : item.tipo_dato === 'numero' ? 'number' : 'text'}
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && guardarValor()}
                  autoFocus
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 w-48"
                />
                <button
                  onClick={guardarValor}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  Guardar
                </button>
                <button onClick={() => setEditando(false)} className="text-xs text-slate-400 hover:text-slate-600">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditando(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {item.valor_texto || item.valor_fecha || item.valor_numero
                  ? `${item.valor_texto ?? item.valor_fecha ?? item.valor_numero} — editar`
                  : '+ Completar dato'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChecklistInteractivo({ altaId, items }: ChecklistInteractivoProps) {
  const [, forceUpdate] = useState(0)

  const requeridos = items.filter(i => i.requerido)
  const opcionales = items.filter(i => !i.requerido)

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Documentación</h2>

      {requeridos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Requeridos</p>
          {requeridos.map(item => (
            <ItemRow key={item.id} item={item} altaId={altaId} onUpdate={() => forceUpdate(n => n + 1)} />
          ))}
        </div>
      )}

      {opcionales.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Opcionales</p>
          {opcionales.map(item => (
            <ItemRow key={item.id} item={item} altaId={altaId} onUpdate={() => forceUpdate(n => n + 1)} />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">Sin ítems en el checklist</p>
      )}
    </section>
  )
}
