'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { BadgeDollarSign, Clock, AlertCircle } from 'lucide-react'
import { pasarALiquidacion } from '@/app/actions/prepaga-actions'
import { ChecklistInteractivo } from './ChecklistInteractivo'

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
  drive_file_url: string | null
}

interface Props {
  altaId: string
  items: Item[]
  estado: string
  isAdmin: boolean
  /** Si ya existe comisión, el trámite ya pasó a liquidación. */
  yaLiquidando: boolean
}

/**
 * Documentación que recién existe después de que el admin aprueba el alta
 * —en un desregulado de relación de dependencia, la constancia de derivación
 * de aportes— y el pase a liquidación que habilita.
 *
 * Antes de la aprobación la sección se muestra pero no se puede cargar: el
 * documento todavía no existe, y mostrarlo como pendiente evita la pregunta
 * "¿me falta algo?" cuando en realidad falta que la prepaga responda.
 */
export function DocumentacionPosterior({ altaId, items, estado, isAdmin, yaLiquidando }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (items.length === 0) return null

  const aprobada = estado === 'aprobada'
  const pendientes = items.filter(i => i.requerido && !i.completado)

  function pasar() {
    startTransition(async () => {
      const res = await pasarALiquidacion(altaId)
      if (res.error) { toast.error(res.error); return }
      toast.success('El trámite pasó a liquidación: se generó la comisión')
      router.refresh()
    })
  }

  if (!aprobada) {
    return (
      <section className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-5">
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Documentación posterior a la aprobación
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Se carga una vez que el admin apruebe el alta. No hace falta para enviar el trámite.
        </p>
        <ul className="mt-3 space-y-1">
          {items.map(i => (
            <li key={i.id} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              {i.etiqueta}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <ChecklistInteractivo
        altaId={altaId}
        items={items}
        titulo="Documentación posterior a la aprobación"
        isAdmin={isAdmin}
      />

      {yaLiquidando ? (
        <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 p-5 flex items-center gap-3">
          <BadgeDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            El trámite ya pasó a liquidación.
          </p>
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
            Pasar a liquidación
          </h2>

          {pendientes.length > 0 ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5" />
                La comisión se genera cuando esté adjunto:
              </p>
              <ul className="space-y-1">
                {pendientes.map(i => (
                  <li key={i.id} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                    {i.etiqueta}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Está toda la documentación. Al pasar a liquidación se genera la comisión de esta venta.
            </p>
          )}

          {isAdmin ? (
            <button
              onClick={pasar}
              disabled={isPending || pendientes.length > 0}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'Pasando...' : 'Pasar a liquidación'}
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              El pase a liquidación lo hace un administrador.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
