import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllPrepagas } from '@/app/actions/prepaga-actions'
import { PrepagasAdminClient } from './PrepagasAdminClient'
import Link from 'next/link'
import { Building2, Calendar } from 'lucide-react'

export const metadata = { title: 'Admin Prepagas | Nexo Asesores' }

export default async function AdminPrepagasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const prepagas = await getAllPrepagas()

  // Cargar asesores disponibles
  const { data: asesores } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('role', 'asesor')
    .order('first_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Gestión de Prepagas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {prepagas.length} prepagas — planes, asesores, checklist
          </p>
        </div>
        <Link
          href="/admin/prepagas/calendarios"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Calendarios
        </Link>
      </div>

      <PrepagasAdminClient prepagas={prepagas} asesores={asesores ?? []} />
    </div>
  )
}
