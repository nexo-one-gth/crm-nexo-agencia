'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearEvento, eliminarEvento } from '@/app/actions/prepaga-actions'
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Evento = {
  id: string
  prepaga_id: string
  fecha: string
  tipo: string
  segmento: string | null
  nota: string | null
  mes_periodo: string
  prepagas?: { nombre: string; slug: string } | null
}

type Prepaga = { id: string; nombre: string; slug: string }

const TIPO_COLORES: Record<string, string> = {
  cierre_comisional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700/40',
  cierre_vigencia:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700/40',
  pago:              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40',
}

const TIPO_LABELS: Record<string, string> = {
  cierre_comisional: 'Cierre com.',
  cierre_vigencia:   'Cierre vig.',
  pago:              'Pago',
}

interface Props {
  mesActual: string
  eventos: Evento[]
  prepagas: Prepaga[]
}

export function CalendarioAdminClient({ mesActual, eventos, prepagas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    prepaga_id: '',
    fecha: '',
    tipo: 'cierre_comisional' as 'cierre_comisional' | 'cierre_vigencia' | 'pago',
    segmento: '',
    nota: '',
  })

  const mesDate = new Date(mesActual + '-01')
  const diasEnMes = getDaysInMonth(mesDate)
  const primerDiaSemana = getDay(startOfMonth(mesDate))

  // Mapa fecha -> eventos
  const eventosPorDia: Record<string, Evento[]> = {}
  eventos.forEach(e => {
    const dia = e.fecha.slice(8, 10)
    if (!eventosPorDia[dia]) eventosPorDia[dia] = []
    eventosPorDia[dia].push(e)
  })

  function navMes(dir: number) {
    const nueva = dir > 0 ? addMonths(mesDate, 1) : subMonths(mesDate, 1)
    router.push(`?mes=${format(nueva, 'yyyy-MM')}`)
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await crearEvento({
        ...form,
        mes_periodo: mesActual,
        segmento: form.segmento || undefined,
        nota: form.nota || undefined,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Evento creado')
      setFormOpen(false)
      setForm({ prepaga_id: '', fecha: '', tipo: 'cierre_comisional', segmento: '', nota: '' })
      router.refresh()
    })
  }

  async function handleEliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarEvento(id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Evento eliminado')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navMes(-1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
            {format(mesDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <button onClick={() => navMes(1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-400">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Leyenda */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
              <span key={tipo} className={`px-2 py-0.5 rounded-full border ${TIPO_COLORES[tipo]}`}>{label}</span>
            ))}
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Agregar evento
          </button>
        </div>
      </div>

      {/* Grilla del calendario */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* Encabezados de días */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/10">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="text-xs font-bold text-slate-400 text-center py-3">{d}</div>
          ))}
        </div>

        {/* Días */}
        <div className="grid grid-cols-7">
          {/* Celdas vacías al inicio */}
          {Array.from({ length: primerDiaSemana }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-100 dark:border-white/5" />
          ))}

          {/* Días del mes */}
          {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
            const diaStr = String(dia).padStart(2, '0')
            const evts = eventosPorDia[diaStr] ?? []
            const esHoy = format(new Date(), 'yyyy-MM-dd') === `${mesActual}-${diaStr}`

            return (
              <div key={dia} className={cn(
                'min-h-[80px] border-b border-r border-slate-100 dark:border-white/5 p-1.5 relative',
                esHoy && 'bg-blue-50/50 dark:bg-blue-900/10',
              )}>
                <span className={cn(
                  'text-xs font-semibold block text-right mb-1',
                  esHoy ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400',
                )}>
                  {dia}
                </span>
                <div className="space-y-0.5">
                  {evts.map(evt => {
                    const prepaga = evt.prepagas
                    return (
                      <div key={evt.id} className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-md border flex items-start justify-between gap-1 leading-tight',
                        TIPO_COLORES[evt.tipo],
                      )}>
                        <span className="truncate max-w-[80%]">
                          {prepaga?.nombre?.split(' ')[0]} {evt.segmento ? `·${evt.segmento.split(',')[0]}` : ''}
                        </span>
                        <button
                          onClick={() => handleEliminar(evt.id)}
                          disabled={isPending}
                          className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form agregar evento */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 dark:text-white">Nuevo evento</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCrear} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Prepaga *</label>
                <select required value={form.prepaga_id} onChange={e => setForm(f => ({ ...f, prepaga_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar...</option>
                  {prepagas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Fecha *</label>
                  <input required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    min={`${mesActual}-01`} max={`${mesActual}-31`}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as typeof form.tipo }))}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="cierre_comisional">Cierre comisional</option>
                    <option value="cierre_vigencia">Cierre vigencia</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Segmento (opcional)
                </label>
                <input value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))}
                  placeholder="directos, monotributo, pymes..."
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nota (opcional)</label>
                <input value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                  placeholder="Ej: Número de socio generado hasta el 31/5"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition-all">
                  {isPending ? 'Guardando...' : 'Guardar evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
