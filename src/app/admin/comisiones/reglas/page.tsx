import Link from 'next/link'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { getPrepagas, getReglasComision } from '@/app/actions/prepaga-actions'
import { ReglasClient, type ReglaComision } from './ReglasClient'

export const metadata = { title: 'Reglas de Comisión | Admin' }

export default async function ReglasComisionPage() {
  const [prepagas, reglas] = await Promise.all([getPrepagas(), getReglasComision()])

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <Link href="/admin/comisiones" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Comisiones
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-blue-600" />
          Reglas de Comisión
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          La escala se define por prepaga + segmento + origen del dato. La regla <span className="font-semibold">General</span> aplica
          a cualquier origen; una regla con origen específico la pisa solo para ese origen.
        </p>
      </div>

      <ReglasClient
        prepagas={prepagas.map(p => ({ id: p.id, nombre: p.nombre }))}
        reglas={reglas as unknown as ReglaComision[]}
      />
    </div>
  )
}
