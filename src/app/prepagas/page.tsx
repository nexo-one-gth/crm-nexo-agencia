import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPrepagas } from '@/app/actions/prepaga-actions'
import { PrepagaCard } from '@/components/prepagas/PrepagaCard'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'

export const metadata = { title: 'Prepagas | Nexo Asesores' }

export default async function PrepagasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = profile?.role === 'admin' || profile?.role === 'admin_principal'

  const prepagas = await getPrepagas()

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Prepagas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {esAdmin ? `${prepagas.length} prepagas en total` : `${prepagas.length} prepagas asignadas`}
          </p>
        </div>
        {esAdmin && (
          <Link
            href="/admin/prepagas"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Gestionar
          </Link>
        )}
      </div>

      {/* Grid */}
      {prepagas.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {esAdmin ? 'No hay prepagas cargadas' : 'No tenés prepagas asignadas todavía'}
          </p>
          {esAdmin && (
            <Link
              href="/admin/prepagas"
              className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Agregar prepaga
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {prepagas.map(prepaga => (
            <PrepagaCard
              key={prepaga.id}
              prepaga={prepaga}
            />
          ))}
        </div>
      )}
    </div>
  )
}
