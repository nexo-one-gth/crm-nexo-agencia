'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, X, Check, Users, Lock } from 'lucide-react'
import { guardarOverride, eliminarOverride, type OverridesData, type OverrideFila } from '@/app/actions/prepaga-actions'
import { AlertDialog } from '@/components/ui/AlertDialog'

type FormState = {
  id?: string
  prepaga_id: string
  pct_equipo: string
  pct_venta_propia: string
  vigente_desde: string
  activo: boolean
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

const formVacio = (prepagaId: string): FormState => ({
  prepaga_id: prepagaId, pct_equipo: '', pct_venta_propia: '', vigente_desde: hoyISO(), activo: true,
})

// '' → null. Es la distinción central del modelo: null significa "no cobra",
// y por eso vacío no puede convertirse en 0.
const num = (v: string) => (v.trim() === '' ? null : Number(v))

const inputClass = 'rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50'

function OverrideForm({ form, setForm, prepagas, onSave, onCancel, isPending }: {
  form: FormState
  setForm: (f: FormState) => void
  prepagas: { id: string; nombre: string }[]
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="px-4 py-3 bg-purple-50/50 dark:bg-purple-900/10 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={form.prepaga_id} onChange={e => setForm({ ...form, prepaga_id: e.target.value })} className={inputClass}>
          {prepagas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          Equipo
          <input type="number" min="0" step="0.01" value={form.pct_equipo}
            onChange={e => setForm({ ...form, pct_equipo: e.target.value })}
            className={`${inputClass} w-20`} placeholder="—" />
          %
        </label>

        <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          Venta propia
          <input type="number" min="0" step="0.01" value={form.pct_venta_propia}
            onChange={e => setForm({ ...form, pct_venta_propia: e.target.value })}
            className={`${inputClass} w-20`} placeholder="—" />
          %
        </label>

        <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          Vigente desde
          <input type="date" value={form.vigente_desde}
            onChange={e => setForm({ ...form, vigente_desde: e.target.value })}
            className={inputClass} />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={form.activo}
            onChange={e => setForm({ ...form, activo: e.target.checked })}
            className="rounded border-slate-300" />
          Activo
        </label>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={onSave} disabled={isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar
          </button>
          <button onClick={onCancel} disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Dejá un porcentaje vacío para que no se pague ese concepto. <span className="font-medium">Equipo</span> es lo que cobra
        por las ventas de sus asesores; <span className="font-medium">venta propia</span>, lo que cobra de override sobre lo que
        vende él mismo, además de su escala de asesor. Ambos son % de la cuota, igual que el resto del sistema.
      </p>
    </div>
  )
}

export function OverridesClient({ data }: { data: OverridesData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(formVacio(''))
  const [eliminar, setEliminar] = useState<OverrideFila | null>(null)

  const { overrides, lideres, prepagas, puedeEditar } = data
  const nombrePrepaga = (id: string) => prepagas.find(p => p.id === id)?.nombre ?? 'Prepaga dada de baja'

  function abrirNuevo(supervisorId: string) {
    setForm(formVacio(prepagas[0]?.id ?? ''))
    setEditando(`nuevo-${supervisorId}`)
  }

  function abrirEdicion(o: OverrideFila) {
    setForm({
      id: o.id,
      prepaga_id: o.prepaga_id,
      pct_equipo: o.pct_equipo === null ? '' : String(o.pct_equipo),
      pct_venta_propia: o.pct_venta_propia === null ? '' : String(o.pct_venta_propia),
      vigente_desde: o.vigente_desde,
      activo: o.activo,
    })
    setEditando(o.id)
  }

  function guardar(supervisorId: string) {
    const equipo = num(form.pct_equipo)
    const propia = num(form.pct_venta_propia)
    if (equipo === null && propia === null) {
      toast.error('Cargá al menos uno de los dos porcentajes')
      return
    }
    if ((equipo !== null && equipo <= 0) || (propia !== null && propia <= 0)) {
      toast.error('Los porcentajes tienen que ser mayores a cero. Para no pagar un concepto, dejalo vacío.')
      return
    }
    if (!form.prepaga_id) { toast.error('Elegí una prepaga'); return }

    startTransition(async () => {
      const res = await guardarOverride({
        id: form.id,
        supervisor_id: supervisorId,
        prepaga_id: form.prepaga_id,
        pct_equipo: equipo,
        pct_venta_propia: propia,
        vigente_desde: form.vigente_desde,
        activo: form.activo,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success(form.id ? 'Override actualizado' : 'Override creado')
      setEditando(null)
      router.refresh()
    })
  }

  function confirmarEliminar() {
    if (!eliminar) return
    const id = eliminar.id
    startTransition(async () => {
      const res = await eliminarOverride(id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Override eliminado. Las comisiones ya generadas conservan su snapshot.')
      router.refresh()
    })
    setEliminar(null)
  }

  if (lideres.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Nadie conduce equipo todavía</p>
        <p className="text-xs text-slate-400 mt-1">El override se configura para quien tiene asesores a cargo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!puedeEditar && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Estás viendo los overrides en modo lectura. Solo el <span className="font-semibold">admin principal</span> puede
            cargarlos o modificarlos — es lo que define cuánto cobra cada líder.
          </p>
        </div>
      )}

      {lideres.map(lider => {
        const suyos = overrides
          .filter(o => o.supervisor_id === lider.id)
          .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))

        return (
          <div key={lider.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{lider.nombre}</p>
                <p className="text-xs text-slate-400">{lider.asesores} asesor{lider.asesores !== 1 ? 'es' : ''} a cargo</p>
              </div>
              {puedeEditar && (
                <button onClick={() => abrirNuevo(lider.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Agregar override
                </button>
              )}
            </div>

            {suyos.length === 0 && editando !== `nuevo-${lider.id}` && (
              <p className="px-4 py-3 text-xs text-slate-400">
                Sin override: no cobra nada por las ventas de su equipo.
              </p>
            )}

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {suyos.map(o => (
                editando === o.id ? (
                  <OverrideForm key={o.id} form={form} setForm={setForm} prepagas={prepagas}
                    onSave={() => guardar(lider.id)} onCancel={() => setEditando(null)} isPending={isPending} />
                ) : (
                  <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{nombrePrepaga(o.prepaga_id)}</span>

                      {o.pct_equipo !== null && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          Equipo {o.pct_equipo}%
                        </span>
                      )}
                      {o.pct_venta_propia !== null && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Venta propia {o.pct_venta_propia}%
                        </span>
                      )}
                      {o.pct_venta_propia === null && (
                        <span className="text-xs text-slate-400">no cobra sobre venta propia</span>
                      )}

                      <span className="text-xs text-slate-400">desde {o.vigente_desde}</span>
                      {!o.activo && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                          Inactivo
                        </span>
                      )}
                    </div>

                    {puedeEditar && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => abrirEdicion(o)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-purple-600 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEliminar(o)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              ))}

              {editando === `nuevo-${lider.id}` && (
                <OverrideForm form={form} setForm={setForm} prepagas={prepagas}
                  onSave={() => guardar(lider.id)} onCancel={() => setEditando(null)} isPending={isPending} />
              )}
            </div>
          </div>
        )
      })}

      <AlertDialog
        isOpen={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar override"
        description={eliminar
          ? `Se elimina el override de ${nombrePrepaga(eliminar.prepaga_id)} vigente desde ${eliminar.vigente_desde}. Las próximas ventas no van a generar la fila de override; las comisiones ya generadas conservan el porcentaje con el que se calcularon.`
          : ''}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
