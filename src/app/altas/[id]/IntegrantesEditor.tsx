'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Users, Plus, Trash2, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  agregarIntegrante,
  actualizarIntegrante,
  eliminarIntegrante,
} from '@/app/actions/prepaga-actions'

export type Integrante = {
  id: string
  rol: string
  orden: number
  nombre: string | null
  dni: string | null
  cuil: string | null
  fecha_nac: string | null
  edad: number | null
  peso_kg: number | null
  altura_cm: number | null
  domicilio: string | null
  telefono: string | null
  email: string | null
  parentesco: string | null
  fum: string | null
}

const ROLES = [
  { value: 'titular', label: 'Titular' },
  { value: 'conyuge', label: 'Cónyuge' },
  { value: 'hijo', label: 'Hijo/a' },
  { value: 'adherente', label: 'Adherente' },
]

const num = (v: string) => (v.trim() === '' ? null : Number(v))
// text-base (16px) en mobile evita el auto-zoom de iOS Safari al enfocar un
// input con font-size < 16px; sm: vuelve a la densidad original en desktop.
const field = 'w-full px-2.5 py-1.5 text-base sm:text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none'
const label = 'block text-[11px] font-medium text-slate-400 mb-0.5'

function IntegranteCard({ integrante, altaId }: { integrante: Integrante; altaId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [f, setF] = useState({
    rol: integrante.rol,
    nombre: integrante.nombre ?? '',
    dni: integrante.dni ?? '',
    cuil: integrante.cuil ?? '',
    fecha_nac: integrante.fecha_nac ?? '',
    edad: integrante.edad?.toString() ?? '',
    peso_kg: integrante.peso_kg?.toString() ?? '',
    altura_cm: integrante.altura_cm?.toString() ?? '',
    domicilio: integrante.domicilio ?? '',
    telefono: integrante.telefono ?? '',
    email: integrante.email ?? '',
    fum: integrante.fum ?? '',
  })
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }))

  const esTitular = f.rol === 'titular'
  // Peso, altura, FUM y domicilio no son solo del titular: la DDJJ de salud los
  // pide para todos los adultos del grupo. En las altas reales el cónyuge viene
  // con esos datos y el editor no tenía dónde ponerlos.
  const esAdulto = f.rol !== 'hijo'

  function guardar() {
    startTransition(async () => {
      const res = await actualizarIntegrante(integrante.id, {
        alta_id: altaId,
        rol: f.rol as 'titular' | 'conyuge' | 'hijo' | 'adherente',
        nombre: f.nombre || null,
        dni: f.dni || null,
        cuil: f.cuil || null,
        fecha_nac: f.fecha_nac || null,
        edad: num(f.edad),
        peso_kg: num(f.peso_kg),
        altura_cm: num(f.altura_cm),
        domicilio: f.domicilio || null,
        telefono: f.telefono || null,
        email: f.email || null,
        fum: f.fum || null,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Integrante guardado')
      router.refresh()
    })
  }

  function borrar() {
    startTransition(async () => {
      const res = await eliminarIntegrante(integrante.id, altaId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Integrante eliminado')
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-3 bg-slate-50/50 dark:bg-white/5">
      <div className="flex items-center gap-2">
        <select value={f.rol} onChange={upd('rol')} className={field + ' w-32 font-semibold'}>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="flex-1" />
        {!esTitular && (
          <button onClick={borrar} disabled={isPending} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>Nombre y apellido</label>
          <input className={field} value={f.nombre} onChange={upd('nombre')} />
        </div>
        <div>
          <label className={label}>DNI</label>
          <input className={field} value={f.dni} onChange={upd('dni')} />
        </div>
        <div>
          <label className={label}>CUIL</label>
          <input className={field} value={f.cuil} onChange={upd('cuil')} />
        </div>
        <div>
          <label className={label}>Fecha nac.</label>
          <input className={field} type="date" value={f.fecha_nac} onChange={upd('fecha_nac')} />
        </div>
        <div>
          <label className={label}>Edad</label>
          <input className={field} type="number" value={f.edad} onChange={upd('edad')} />
        </div>
        {esAdulto && (
          <>
            <div>
              <label className={label}>Peso (kg)</label>
              <input className={field} type="number" value={f.peso_kg} onChange={upd('peso_kg')} />
            </div>
            <div>
              <label className={label}>Altura (cm)</label>
              <input className={field} type="number" value={f.altura_cm} onChange={upd('altura_cm')} />
            </div>
            <div>
              <label className={label}>FUM</label>
              <input className={field} type="date" value={f.fum} onChange={upd('fum')} />
            </div>
            <div className="col-span-2">
              <label className={label}>Domicilio</label>
              <input className={field} value={f.domicilio} onChange={upd('domicilio')} />
            </div>
          </>
        )}
        {esTitular && (
          <>
            <div>
              <label className={label}>Teléfono</label>
              <input className={field} value={f.telefono} onChange={upd('telefono')} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input className={field} value={f.email} onChange={upd('email')} />
            </div>
          </>
        )}
      </div>

      <button
        onClick={guardar}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <Save className="w-3 h-3" />
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}

export function IntegrantesEditor({ altaId, integrantes }: { altaId: string; integrantes: Integrante[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function agregar() {
    startTransition(async () => {
      const res = await agregarIntegrante({ alta_id: altaId, rol: 'hijo' })
      if (res.error) { toast.error(res.error); return }
      router.refresh()
    })
  }

  const ordenados = [...integrantes].sort((a, b) => a.orden - b.orden)

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Integrantes ({integrantes.length})
        </h2>
        <button
          onClick={agregar}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>

      {ordenados.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Sin integrantes cargados</p>
      ) : (
        <div className="space-y-3">
          {ordenados.map(i => <IntegranteCard key={i.id} integrante={i} altaId={altaId} />)}
        </div>
      )}
    </section>
  )
}
