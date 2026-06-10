'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { IniciarAltaDialog } from '@/components/prepagas/IniciarAltaDialog'

interface Props {
  prepagaId: string
  prepagaNombre: string
  leadId?: string
  leadNombre?: string
}

export function IniciarAltaDesdeDetalle({ prepagaId, prepagaNombre, leadId, leadNombre }: Props) {
  const [open, setOpen] = useState(false)
  const [inputLeadId, setInputLeadId] = useState(leadId ?? '')

  // Si no hay leadId precargado, mostrar un input simple
  if (!leadId && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <FileText className="w-4 h-4" />
        Iniciar alta
      </button>
    )
  }

  if (!leadId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 dark:text-white">Iniciar alta</h2>
          <p className="text-sm text-slate-500">Ingresá el ID del prospecto o iniciá el alta desde la ficha del lead.</p>
          <input
            type="text"
            placeholder="ID del prospecto"
            value={inputLeadId}
            onChange={e => setInputLeadId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <FileText className="w-4 h-4" />
        Iniciar alta
      </button>
      <IniciarAltaDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        leadId={leadId}
        leadNombre={leadNombre ?? 'Prospecto'}
        prepagaId={prepagaId}
        prepagaNombre={prepagaNombre}
      />
    </>
  )
}
