'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cerrarCierre, liquidarCierre } from '@/app/actions/prepaga-actions'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { Lock, BadgeCheck, Loader2 } from 'lucide-react'

export function LoteActions({ cierreId, estado, label }: { cierreId: string; estado: string; label: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirmar, setConfirmar] = useState<'cerrar' | 'liquidar' | null>(null)
  const router = useRouter()

  function ejecutar(accion: 'cerrar' | 'liquidar') {
    startTransition(async () => {
      const res = accion === 'cerrar' ? await cerrarCierre(cierreId) : await liquidarCierre(cierreId)
      if (res.error) { toast.error(res.error); return }
      toast.success(accion === 'cerrar' ? 'Lote cerrado' : 'Lote liquidado: todas sus comisiones quedaron liquidadas')
      router.refresh()
    })
    setConfirmar(null)
  }

  if (estado === 'liquidado') return null

  return (
    <>
      {estado === 'abierto' && (
        <button
          onClick={() => setConfirmar('cerrar')}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 shrink-0"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
          Cerrar lote
        </button>
      )}
      {estado === 'cerrado' && (
        <button
          onClick={() => setConfirmar('liquidar')}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shrink-0"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
          Liquidar lote
        </button>
      )}

      <AlertDialog
        isOpen={confirmar !== null}
        onClose={() => setConfirmar(null)}
        onConfirm={() => confirmar && ejecutar(confirmar)}
        title={confirmar === 'cerrar' ? `Cerrar el lote ${label}` : `Liquidar el lote ${label}`}
        description={
          confirmar === 'cerrar'
            ? 'El lote deja de recibir ventas nuevas: las próximas altas aprobadas de esta prepaga abren un lote nuevo. Después vas a poder liquidarlo.'
            : 'Se marcan como liquidadas TODAS las comisiones pendientes de este lote. Esta acción no se puede deshacer.'
        }
        confirmLabel={confirmar === 'cerrar' ? 'Cerrar lote' : 'Liquidar lote'}
      />
    </>
  )
}
