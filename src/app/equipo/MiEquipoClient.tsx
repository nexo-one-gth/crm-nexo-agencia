'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Users, UserCheck, Shuffle, Inbox, CheckSquare, Square, Phone } from 'lucide-react'
import { assignLeadsToAdvisor } from '@/app/actions/lead-actions'
import {
  getMiEquipoReparto,
  repartirEquitativo,
  type MiEquipoData,
} from '@/app/actions/team-actions'

interface Props {
  data: MiEquipoData
}

export function MiEquipoClient({ data: dataInicial }: Props) {
  const [data, setData] = useState<MiEquipoData>(dataInicial)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [asesorDestino, setAsesorDestino] = useState<string>('')
  const [procesando, setProcesando] = useState(false)

  const { asesores, pendientes } = data
  const seleccion = [...sel]
  const todosSel = pendientes.length > 0 && sel.size === pendientes.length
  const mias = pendientes.filter(p => p.origen === 'mia').length

  const toggle = (id: string) => {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  const toggleTodos = () => {
    setSel(todosSel ? new Set() : new Set(pendientes.map(p => p.id)))
  }

  const refrescar = async () => {
    const r = await getMiEquipoReparto()
    if (r.data) setData(r.data)
    setSel(new Set())
  }

  const asignarAUno = async () => {
    if (!asesorDestino) { toast.error('Elegí un asesor'); return }
    if (!seleccion.length) { toast.error('Seleccioná al menos un lead'); return }
    setProcesando(true)
    const res = await assignLeadsToAdvisor(seleccion, asesorDestino)
    if (res.success) {
      const nombre = asesores.find(a => a.id === asesorDestino)?.nombre ?? 'el asesor'
      toast.success(`${seleccion.length} leads asignados a ${nombre}`)
      await refrescar()
    } else {
      toast.error(res.error ?? 'Error al asignar')
    }
    setProcesando(false)
  }

  const repartir = async () => {
    if (!seleccion.length) { toast.error('Seleccioná al menos un lead'); return }
    if (asesores.length === 0) { toast.error('No tenés asesores en tu equipo'); return }
    setProcesando(true)
    const res = await repartirEquitativo(seleccion, asesores.map(a => a.id))
    if (res.success) {
      toast.success(`${res.asignados} leads repartidos entre ${asesores.length} asesores`)
      await refrescar()
    } else {
      toast.error(res.error ?? 'Error al repartir')
    }
    setProcesando(false)
  }

  return (
    <div className="space-y-6">
      {/* ---------- Equipo ---------- */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Tu equipo ({asesores.length})
        </p>
        {asesores.length === 0 ? (
          <p className="text-sm text-slate-500">No tenés asesores asignados a tu equipo todavía.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {asesores.map(a => (
              <div key={a.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-black uppercase shrink-0">
                    {a.nombre.slice(0, 2)}
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{a.nombre}</p>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    <span className="font-black text-slate-700 dark:text-slate-200">{a.activos}</span> activos
                  </span>
                  <span className="text-slate-400">{a.total} total</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Pendientes de reparto ---------- */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" /> Para repartir ({pendientes.length})
            {mias > 0 && <span className="text-slate-400 normal-case font-bold tracking-normal">· {mias} asignados a vos</span>}
          </p>
          {pendientes.length > 0 && (
            <button
              type="button"
              onClick={toggleTodos}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {todosSel ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {todosSel ? 'Ninguno' : 'Todos'}
            </button>
          )}
        </div>

        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-500">No hay leads sin asignar. 🎉</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
            {pendientes.map(l => {
              const checked = sel.has(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${checked ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                  {checked ? <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{l.nombre}</p>
                    {l.telefono && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{l.telefono}</p>
                    )}
                  </div>
                  {l.origen === 'mia' && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded shrink-0">Para vos</span>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">{l.etapa}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------- Barra de acción (sticky abajo) ---------- */}
      {sel.size > 0 && (
        <div className="sticky bottom-24 z-10 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3">
          <p className="text-sm font-black text-slate-700 dark:text-slate-200">{sel.size} leads seleccionados</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex gap-2">
              <select
                value={asesorDestino}
                onChange={e => setAsesorDestino(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Asignar a…</option>
                {asesores.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.activos} activos)</option>
                ))}
              </select>
              <button
                type="button"
                onClick={asignarAUno}
                disabled={procesando || !asesorDestino}
                className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black transition-colors"
              >
                {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Asignar
              </button>
            </div>
            <button
              type="button"
              onClick={repartir}
              disabled={procesando || asesores.length === 0}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-black transition-colors"
              title="Reparte los seleccionados en partes iguales entre todo tu equipo"
            >
              {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              Repartir equitativo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
