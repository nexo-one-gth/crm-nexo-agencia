import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMisComisiones } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { BadgeDollarSign, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata = { title: 'Mis Comisiones | Nexo Asesores' }

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  liquidada: { label: 'Liquidada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

const SEGMENTO_LABEL: Record<string, string> = {
  particular: 'Particular',
  relacion_dependencia: 'Relación de dependencia',
  monotributo: 'Monotributo',
  pmo: 'PMO / Aportes',
}

const formatMoney = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)

export default async function ComisionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const comisiones = await getMisComisiones()

  const totalPendiente = comisiones.filter(c => c.estado === 'pendiente').reduce((sum, c) => sum + Number(c.monto_comision), 0)
  const totalLiquidado = comisiones.filter(c => c.estado === 'liquidada').reduce((sum, c) => sum + Number(c.monto_comision), 0)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BadgeDollarSign className="w-6 h-6 text-emerald-600" />
          Mis Comisiones
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Se generan automáticamente cuando un admin aprueba una de tus altas.
        </p>
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

      {comisiones.length === 0 ? (
        <div className="text-center py-16">
          <BadgeDollarSign className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Todavía no tenés comisiones generadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comisiones.map(c => {
            const lead = c.leads as { first_name: string; last_name: string | null } | null
            const prepaga = c.prepagas as { nombre: string } | null
            const badge = ESTADO_BADGE[c.estado] ?? ESTADO_BADGE.pendiente

            return (
              <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {lead?.first_name} {lead?.last_name} <span className="text-slate-400">· {prepaga?.nombre}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                      <span className="text-xs text-slate-400">{SEGMENTO_LABEL[c.segmento] ?? c.segmento}</span>
                      <span className="text-xs text-slate-400">{format(new Date(c.created_at), "d MMM yyyy", { locale: es })}</span>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{formatMoney(Number(c.monto_comision))}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
