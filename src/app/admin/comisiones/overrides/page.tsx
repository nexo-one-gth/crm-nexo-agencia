import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { getOverridesData } from '@/app/actions/prepaga-actions'
import { OverridesClient } from './OverridesClient'

export const metadata = { title: 'Overrides de líder | Admin' }

export default async function OverridesPage() {
  const data = await getOverridesData()

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <Link href="/admin/comisiones" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Comisiones
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-600" />
          Overrides de líder
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Lo que cobra quien conduce un equipo, por prepaga. Al aprobar una venta el override se emite
          <span className="font-semibold"> por la relación</span> —tener gente a cargo— y nunca por el rol, así que
          un admin que además lidera cobra igual.
        </p>
      </div>

      <OverridesClient data={data} />
    </div>
  )
}
