import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSupervisorOrAdminRole } from '@/lib/supabase/assert-admin'
import { getMiEquipoReparto } from '@/app/actions/team-actions'
import { MiEquipoClient } from './MiEquipoClient'
import { Users } from 'lucide-react'

export const metadata = { title: 'Mi Equipo | Nexo Salud' }

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isSupervisorOrAdminRole(profile?.role)) redirect('/')

  const { data, error } = await getMiEquipoReparto()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Mi Equipo
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Repartí los leads sin asignar entre tus asesores.
        </p>
      </div>

      {error || !data ? (
        <p className="text-sm text-rose-600 font-semibold">{error ?? 'No se pudo cargar el equipo'}</p>
      ) : (
        <MiEquipoClient data={data} />
      )}
    </div>
  )
}
