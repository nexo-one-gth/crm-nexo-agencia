'use client'

import { useMemo, useState } from 'react'
import { Scale, TriangleAlert } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { VentaMargen } from '@/app/actions/prepaga-actions'
import { cn } from '@/lib/utils'

type Corte = 'prepaga' | 'mes' | 'vendedor' | 'lider'

const CORTE_LABEL: Record<Corte, string> = {
  prepaga: 'Prepaga',
  mes: 'Mes',
  vendedor: 'Asesor',
  lider: 'Equipo',
}

const money = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

const clave = (v: VentaMargen, corte: Corte) => {
  if (corte === 'prepaga') return v.prepaga
  if (corte === 'vendedor') return v.vendedor
  if (corte === 'lider') return v.lider ?? 'Sin equipo asignado'
  return format(new Date(v.mes + '-02'), 'MMMM yyyy', { locale: es })
}

function Metrica({ label, valor, tono }: { label: string; valor: number; tono: 'neutro' | 'pago' | 'margen' }) {
  const color = tono === 'pago'
    ? 'text-amber-700 dark:text-amber-300'
    : tono === 'margen'
      ? valor < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
      : 'text-slate-900 dark:text-white'
  const fondo = tono === 'pago'
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/20'
    : tono === 'margen'
      ? valor < 0
        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-500/20'
        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/20'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'

  return (
    <div className={`rounded-2xl border p-4 ${fondo}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{money(valor)}</p>
    </div>
  )
}

export function MargenClient({ ventas }: { ventas: VentaMargen[] }) {
  const [corte, setCorte] = useState<Corte>('prepaga')

  const totales = useMemo(() => ({
    facturacion: ventas.reduce((s, v) => s + v.facturacion, 0),
    pagos: ventas.reduce((s, v) => s + v.pagoDirecto + v.pagoOverride, 0),
    margen: ventas.reduce((s, v) => s + v.margen, 0),
  }), [ventas])

  const grupos = useMemo(() => {
    const mapa = new Map<string, VentaMargen[]>()
    for (const v of ventas) {
      const k = clave(v, corte)
      mapa.set(k, [...(mapa.get(k) ?? []), v])
    }
    return [...mapa.entries()]
      .map(([nombre, items]) => ({
        nombre,
        items,
        facturacion: items.reduce((s, v) => s + v.facturacion, 0),
        pagos: items.reduce((s, v) => s + v.pagoDirecto + v.pagoOverride, 0),
        margen: items.reduce((s, v) => s + v.margen, 0),
      }))
      .sort((a, b) => b.facturacion - a.facturacion || a.nombre.localeCompare(b.nombre))
  }, [ventas, corte])

  const negativas = ventas.filter(v => v.margen < 0)
  const sinDirecta = ventas.filter(v => v.sinFilaDirecta)

  if (ventas.length === 0) {
    return (
      <div className="text-center py-16">
        <Scale className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Todavía no hay ventas con comisión generada</p>
        <p className="text-xs text-slate-400 mt-1">El margen se calcula sobre las comisiones, que nacen al aprobar un alta.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metrica label="Facturación NEXO" valor={totales.facturacion} tono="neutro" />
        <Metrica label="Pago de comisiones" valor={totales.pagos} tono="pago" />
        <Metrica label="Margen" valor={totales.margen} tono="margen" />
      </div>

      {(negativas.length > 0 || sinDirecta.length > 0) && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-900/10 px-4 py-3 space-y-1">
          {negativas.length > 0 && (
            <p className="text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">{negativas.length} venta{negativas.length !== 1 ? 's' : ''} con margen negativo</span> —
                lo que cobran el asesor y su líder supera lo que paga la prepaga. Casi siempre es un porcentaje mal cargado.
              </span>
            </p>
          )}
          {sinDirecta.length > 0 && (
            <p className="text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">{sinDirecta.length} venta{sinDirecta.length !== 1 ? 's' : ''} sin comisión directa</span> —
                solo tienen override, así que no hay porcentaje de prepaga y su facturación no se puede calcular.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
        {(Object.keys(CORTE_LABEL) as Corte[]).map(c => (
          <button key={c} onClick={() => setCorte(c)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              corte === c
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}>
            {CORTE_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {grupos.map(g => (
          <section key={g.nombre} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
              {/* first-letter y no `capitalize`: hace falta solo para el mes,
                  que date-fns devuelve en minúscula ("agosto 2026"). Con
                  `capitalize`, "Sin equipo asignado" salía "Sin Equipo Asignado". */}
              <p className="font-bold text-sm text-slate-900 dark:text-white first-letter:uppercase">
                {g.nombre}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {g.items.length} venta{g.items.length !== 1 ? 's' : ''}
                </span>
              </p>
              <div className="flex items-center gap-4 text-xs tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Factura <span className="font-semibold text-slate-700 dark:text-slate-200">{money(g.facturacion)}</span></span>
                <span className="text-slate-500 dark:text-slate-400">Paga <span className="font-semibold text-amber-600 dark:text-amber-400">{money(g.pagos)}</span></span>
                <span className={cn('font-bold', g.margen < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {money(g.margen)}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {g.items.map(v => (
                <div key={v.altaId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{v.lead}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-400">
                      <span>{v.prepaga}</span>
                      <span>·</span>
                      <span>{v.vendedor}</span>
                      {v.lider && <><span>·</span><span>equipo {v.lider}</span></>}
                      <span>·</span>
                      <span>{format(new Date(v.fecha), 'd MMM yyyy', { locale: es })}</span>
                      {v.sinFilaDirecta && (
                        <span className="font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                          sin comisión directa
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs tabular-nums">
                    <p className="text-slate-500 dark:text-slate-400">
                      {money(v.facturacion)} − {money(v.pagoDirecto + v.pagoOverride)}
                      {v.pagoOverride > 0 && (
                        <span className="text-slate-400"> (incl. {money(v.pagoOverride)} override)</span>
                      )}
                    </p>
                    <p className={cn('text-sm font-bold', v.margen < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {money(v.margen)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
