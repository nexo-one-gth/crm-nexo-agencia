import Link from 'next/link'
import { ArrowLeft, Scale } from 'lucide-react'
import { getFacturacionYMargen } from '@/app/actions/prepaga-actions'
import { MargenClient } from './MargenClient'

export const metadata = { title: 'Facturación y margen | Admin' }

export default async function MargenPage() {
  const ventas = await getFacturacionYMargen()

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <Link href="/admin/comisiones" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Comisiones
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-emerald-600" />
          Facturación y margen
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Lo que la prepaga le paga a NEXO menos lo que NEXO le paga al asesor y a su líder. Todos los porcentajes
          están en la misma unidad —% de la cuota— y se restan; ninguno se multiplica por otro.
        </p>
      </div>

      <MargenClient ventas={ventas} />
    </div>
  )
}
