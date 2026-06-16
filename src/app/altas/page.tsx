import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAltas } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { FileText, Plus, ChevronRight } from 'lucide-react'
import { ChecklistProgress } from '@/components/prepagas/ChecklistProgress'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata = { title: 'Altas en proceso | Nexo Asesores' }

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  en_proceso:  { label: 'En proceso',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  enviada:     { label: 'Enviada',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  observada:   { label: 'Observada',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  aprobada:    { label: 'Aprobada',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rechazada:   { label: 'Rechazada',   color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default async function AltasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = profile?.role === 'admin' || profile?.role === 'admin_principal'

  const altas = await getAltas()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Altas en proceso
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {altas.length} {altas.length === 1 ? 'alta' : 'altas'} {esAdmin ? 'en total' : 'tuyas'}
          </p>
        </div>
        <Link
          href="/prepagas"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nueva alta
        </Link>
      </div>

      {altas.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Sin altas en proceso</p>
          <Link
            href="/prepagas"
            className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Ir a prepagas
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {altas.map(alta => {
            const items = (alta.alta_items ?? []) as { requerido: boolean; completado: boolean }[]
            const requeridos = items.filter(i => i.requerido).length
            const completados = items.filter(i => i.requerido && i.completado).length
            const lead = alta.leads as { first_name: string; last_name: string | null } | null
            const prepaga = alta.prepagas as { nombre: string } | null
            const plan = alta.prepaga_planes as { nombre: string } | null
            const badge = ESTADO_BADGE[alta.estado] ?? ESTADO_BADGE.en_proceso

            return (
              <Link
                key={alta.id}
                href={`/altas/${alta.id}`}
                className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">
                      {lead?.first_name} {lead?.last_name}
                    </p>
                    <span className="text-xs text-slate-400">—</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{prepaga?.nombre}</p>
                    {plan && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <p className="text-xs text-slate-500">{plan.nombre}</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(alta.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>

                  {requeridos > 0 && (
                    <div className="mt-2 max-w-xs">
                      <ChecklistProgress
                        totalRequeridos={requeridos}
                        completados={completados}
                        totalItems={items.length}
                        showDetail={false}
                        size="sm"
                      />
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
