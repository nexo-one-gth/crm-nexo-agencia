import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllPrepagas, getEventosPorMes } from '@/app/actions/prepaga-actions'
import { CalendarioAdminClient } from './CalendarioAdminClient'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata = { title: 'Calendarios | Admin Prepagas' }

interface Props {
  searchParams: Promise<{ mes?: string }>
}

export default async function CalendariosPage({ searchParams }: Props) {
  const { mes } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const mesActual = mes ?? format(new Date(), 'yyyy-MM')
  const [prepagas, eventos] = await Promise.all([
    getAllPrepagas(),
    getEventosPorMes(mesActual),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/prepagas"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Gestión de prepagas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" />
          Calendarios de cierre y pagos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {format(new Date(mesActual + '-01'), "MMMM yyyy", { locale: es })} — {eventos.length} eventos
        </p>
      </div>

      <CalendarioAdminClient
        mesActual={mesActual}
        eventos={eventos}
        prepagas={prepagas}
      />
    </div>
  )
}
