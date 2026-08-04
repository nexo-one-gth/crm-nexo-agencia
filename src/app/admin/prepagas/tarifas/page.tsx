import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/supabase/assert-admin'
import { listarTarifariosPremedic } from '@/app/actions/premedic-tarifas'
import { TarifasPremedicClient } from './TarifasPremedicClient'
import Link from 'next/link'
import { FileSpreadsheet, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Tarifario Premedic | Nexo Asesores' }

export default async function TarifasPremedicPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) redirect('/')

  const { meses, error } = await listarTarifariosPremedic()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/prepagas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Prepagas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          Tarifario Premedic
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Actualizá la lista de precios del mes: elegí el PDF, revisá los valores y confirmá.
        </p>
      </div>

      <TarifasPremedicClient mesesIniciales={meses} errorInicial={error} />
    </div>
  )
}
