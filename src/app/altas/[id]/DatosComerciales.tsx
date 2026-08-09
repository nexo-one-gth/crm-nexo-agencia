'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BadgeDollarSign, Save } from 'lucide-react'
import { guardarDatosComerciales } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'

type TipoAlta = 'particular' | 'relacion_dependencia' | 'monotributo' | 'pmo'

type Datos = {
  plan_codigo: string | null
  tipo_alta: string | null
  cantidad_capitas: number | null
  cuota: number | null
  aportes_promedio: number | null
  sueldo_bruto: number | null
  periodo_aportes: string | null
}

const num = (v: string) => (v.trim() === '' ? null : Number(v))

const TIPOS_ALTA: { value: TipoAlta; label: string }[] = [
  { value: 'particular', label: 'Particular / Directo' },
  { value: 'relacion_dependencia', label: 'Relación de dependencia' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'pmo', label: 'PMO / Aportes (afinidad)' },
]

export function DatosComerciales({ altaId, datos }: { altaId: string; datos: Datos }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    plan_codigo: datos.plan_codigo ?? '',
    tipo_alta: datos.tipo_alta ?? '',
    cantidad_capitas: datos.cantidad_capitas?.toString() ?? '',
    cuota: datos.cuota?.toString() ?? '',
    aportes_promedio: datos.aportes_promedio?.toString() ?? '',
    sueldo_bruto: datos.sueldo_bruto?.toString() ?? '',
    periodo_aportes: datos.periodo_aportes ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  function guardar() {
    startTransition(async () => {
      const res = await guardarDatosComerciales({
        alta_id: altaId,
        plan_codigo: form.plan_codigo || null,
        tipo_alta: (form.tipo_alta || null) as TipoAlta | null,
        cantidad_capitas: num(form.cantidad_capitas),
        cuota: num(form.cuota),
        aportes_promedio: num(form.aportes_promedio),
        sueldo_bruto: num(form.sueldo_bruto),
        periodo_aportes: form.periodo_aportes || null,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Datos guardados')
      router.refresh()
    })
  }

  const field = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none'
  const label = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <BadgeDollarSign className="w-4 h-4 text-blue-500" />
        Datos del trámite
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Código de plan</label>
          <input className={field} value={form.plan_codigo} onChange={set('plan_codigo')} placeholder="GA1506" />
        </div>
        <div>
          <label className={label}>Tipo de alta — define la comisión</label>
          <select
            className={field}
            value={form.tipo_alta}
            onChange={e => setForm(f => ({ ...f, tipo_alta: e.target.value }))}
          >
            <option value="">Sin definir</option>
            {TIPOS_ALTA.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Cápitas</label>
          <input className={field} type="number" value={form.cantidad_capitas} onChange={set('cantidad_capitas')} placeholder="2" />
        </div>
        <div>
          <label className={label}>Cuota ($)</label>
          <input className={field} type="number" value={form.cuota} onChange={set('cuota')} placeholder="60000" />
        </div>
        <div>
          <label className={label}>Aportes promedio ($)</label>
          <input className={field} type="number" value={form.aportes_promedio} onChange={set('aportes_promedio')} placeholder="76803.11" />
        </div>
        <div>
          <label className={label}>Sueldo bruto ($)</label>
          <input className={field} type="number" value={form.sueldo_bruto} onChange={set('sueldo_bruto')} placeholder="2560103.66" />
        </div>
        <div className="col-span-2">
          <label className={label}>Período de aportes</label>
          <input className={field} value={form.periodo_aportes} onChange={set('periodo_aportes')} placeholder="Junio 2026" />
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={isPending}
        className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {isPending ? 'Guardando...' : 'Guardar datos'}
      </button>
    </section>
  )
}
