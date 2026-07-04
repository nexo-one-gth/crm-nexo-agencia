import Link from 'next/link'
import { getCierresAdmin, getComisionesAdmin } from '@/app/actions/prepaga-actions'
import { BadgeDollarSign, Layers, SlidersHorizontal } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { origenLabel } from '@/lib/origen'
import { LoteActions } from './LoteActions'

export const metadata = { title: 'Comisiones | Admin' }

const ESTADO_COMISION_BADGE: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  liquidada: { label: 'Liquidada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

const ESTADO_LOTE_BADGE: Record<string, { label: string; color: string }> = {
  abierto: { label: 'Abierto', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  cerrado: { label: 'Cerrado', color: 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300' },
  liquidado: { label: 'Liquidado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

const SEGMENTO_LABEL: Record<string, string> = {
  particular: 'Particular',
  relacion_dependencia: 'Relación de dependencia',
  monotributo: 'Monotributo',
  pmo: 'PMO / Aportes',
}

const formatMoney = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)

type ComisionLote = {
  id: string
  monto_comision: number
  estado: string
  segmento: string
  origen: string | null
  created_at: string
  leads: { first_name: string; last_name: string | null; campaigns: { name: string } | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

export default async function AdminComisionesPage() {
  const [cierres, comisiones] = await Promise.all([getCierresAdmin(), getComisionesAdmin()])

  const totalPendiente = comisiones.filter(c => c.estado === 'pendiente').reduce((sum, c) => sum + Number(c.monto_comision), 0)
  const totalLiquidado = comisiones.filter(c => c.estado === 'liquidada').reduce((sum, c) => sum + Number(c.monto_comision), 0)

  // Comisiones viejas que quedaron sin lote (no debería haber después del backfill)
  const sinLote = comisiones.filter(c => !c.cierre_id)

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-emerald-600" />
            Comisiones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cada venta aprobada entra al lote abierto de su prepaga. La liquidación se hace por lote (cierre comisional).
          </p>
        </div>
        <Link href="/admin/comisiones/reglas"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Reglas de comisión
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendiente de liquidar</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{formatMoney(totalPendiente)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Liquidado</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatMoney(totalLiquidado)}</p>
        </div>
      </div>

      {cierres.length === 0 && sinLote.length === 0 ? (
        <div className="text-center py-16">
          <BadgeDollarSign className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Todavía no se generó ninguna comisión</p>
          <p className="text-xs text-slate-400 mt-1">Los lotes se crean automáticamente al aprobar la primera alta de cada prepaga</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cierres.map(cierre => {
            const prepaga = cierre.prepagas as { nombre: string } | null
            const items = (cierre.comisiones ?? []) as unknown as ComisionLote[]
            const total = items.reduce((sum, c) => sum + Number(c.monto_comision), 0)
            const loteBadge = ESTADO_LOTE_BADGE[cierre.estado] ?? ESTADO_LOTE_BADGE.abierto
            const label = `${prepaga?.nombre ?? 'Prepaga'} · ${cierre.mes_periodo}`

            // Subtotal por asesor para la liquidación
            const porAsesor = new Map<string, number>()
            items.forEach(c => {
              const nombre = `${c.profiles?.first_name ?? ''} ${c.profiles?.last_name ?? ''}`.trim() || 'Sin asesor'
              porAsesor.set(nombre, (porAsesor.get(nombre) ?? 0) + Number(c.monto_comision))
            })

            return (
              <div key={cierre.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                {/* Header del lote */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{label}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${loteBadge.color}`}>{loteBadge.label}</span>
                    <span className="text-xs text-slate-400 shrink-0">{items.length} venta{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(total)}</p>
                    <LoteActions cierreId={cierre.id} estado={cierre.estado} label={label} />
                  </div>
                </div>

                {/* Subtotales por asesor */}
                {porAsesor.size > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 dark:border-white/10">
                    {[...porAsesor.entries()].map(([nombre, monto]) => (
                      <span key={nombre} className="text-xs text-slate-500 dark:text-slate-400">
                        {nombre}: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatMoney(monto)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Comisiones del lote */}
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400">Sin ventas todavía. Las próximas altas aprobadas de esta prepaga entran acá.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {items.map(c => {
                      const badge = ESTADO_COMISION_BADGE[c.estado] ?? ESTADO_COMISION_BADGE.pendiente
                      const campania = c.leads?.campaigns?.name
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {c.leads?.first_name} {c.leads?.last_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                              <span className="text-xs text-slate-400">Asesor: {c.profiles?.first_name} {c.profiles?.last_name}</span>
                              <span className="text-xs text-slate-400">{SEGMENTO_LABEL[c.segmento] ?? c.segmento}</span>
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                {origenLabel(c.origen)}{campania ? `: ${campania}` : ''}
                              </span>
                              <span className="text-xs text-slate-400">{format(new Date(c.created_at), 'd MMM yyyy', { locale: es })}</span>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{formatMoney(Number(c.monto_comision))}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Comisiones legacy sin lote */}
          {sinLote.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-white/20 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                <p className="font-bold text-sm text-slate-500 dark:text-slate-400">Comisiones sin lote asignado</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {sinLote.map(c => {
                  const lead = c.leads as { first_name: string; last_name: string | null } | null
                  const prepaga = c.prepagas as { nombre: string } | null
                  const badge = ESTADO_COMISION_BADGE[c.estado] ?? ESTADO_COMISION_BADGE.pendiente
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {lead?.first_name} {lead?.last_name} <span className="text-slate-400">· {prepaga?.nombre}</span>
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{formatMoney(Number(c.monto_comision))}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
