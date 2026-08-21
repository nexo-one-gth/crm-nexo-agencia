import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAltasTablero } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { AltasTablero } from './AltasTablero'

export const metadata = { title: 'Altas | Nexo Asesores' }

export default async function AltasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const datos = await getAltasTablero()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* Antes decía "Altas en proceso" y listaba también las aprobadas y
              rechazadas. El título ahora nombra el ciclo completo, que es lo
              que la pantalla realmente muestra. */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Altas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Trámites en todo su ciclo, agrupados por equipo
          </p>
        </div>
        <Link
          href="/prepagas"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva alta
        </Link>
      </div>

      {datos.rows.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Todavía no hay altas</p>
          <Link
            href="/prepagas"
            className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Ir a prepagas
          </Link>
        </div>
      ) : (
        <AltasTablero datos={datos} />
      )}
    </div>
  )
}
