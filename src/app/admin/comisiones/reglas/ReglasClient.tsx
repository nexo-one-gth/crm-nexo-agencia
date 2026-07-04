'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, X, Check } from 'lucide-react'
import { guardarReglaComision, eliminarReglaComision } from '@/app/actions/prepaga-actions'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { origenLabel } from '@/lib/origen'

export type ReglaComision = {
  id: string
  prepaga_id: string
  segmento: 'particular' | 'relacion_dependencia' | 'monotributo' | 'pmo'
  origen: 'nexo' | 'referido' | 'campania' | null
  tipo_base: 'valor_plan' | 'pct_sueldo_bruto'
  porcentaje: number
  notas: string | null
}

const SEGMENTO_LABEL: Record<string, string> = {
  particular: 'Particular',
  relacion_dependencia: 'Relación de dependencia',
  monotributo: 'Monotributo',
  pmo: 'PMO / Aportes',
}

const TIPO_BASE_LABEL: Record<string, string> = {
  valor_plan: '% sobre valor del plan',
  pct_sueldo_bruto: '% sobre sueldo bruto',
}

const SEGMENTOS = Object.keys(SEGMENTO_LABEL) as ReglaComision['segmento'][]

type FormState = {
  id?: string
  segmento: ReglaComision['segmento']
  origen: string // '' = regla general
  tipo_base: ReglaComision['tipo_base']
  porcentaje: string
  notas: string
}

const FORM_VACIO: FormState = { segmento: 'particular', origen: '', tipo_base: 'valor_plan', porcentaje: '100', notas: '' }

const inputClass = 'rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50'

function ReglaForm({ form, setForm, onSave, onCancel, isPending }: {
  form: FormState
  setForm: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10">
      <select value={form.segmento} onChange={e => setForm({ ...form, segmento: e.target.value as FormState['segmento'] })} className={inputClass}>
        {SEGMENTOS.map(s => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
      </select>
      <select value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} className={inputClass}>
        <option value="">General (todos los orígenes)</option>
        <option value="nexo">Origen Nexo</option>
        <option value="referido">Referido</option>
        <option value="campania">Campaña</option>
      </select>
      <select value={form.tipo_base} onChange={e => setForm({ ...form, tipo_base: e.target.value as FormState['tipo_base'] })} className={inputClass}>
        <option value="valor_plan">{TIPO_BASE_LABEL.valor_plan}</option>
        <option value="pct_sueldo_bruto">{TIPO_BASE_LABEL.pct_sueldo_bruto}</option>
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number" min="0" step="0.001" value={form.porcentaje}
          onChange={e => setForm({ ...form, porcentaje: e.target.value })}
          className={`${inputClass} w-20`} placeholder="%"
        />
        <span className="text-xs text-slate-400">%</span>
      </div>
      <input
        value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
        className={`${inputClass} flex-1 min-w-[140px]`} placeholder="Notas (decomisión, plazos...)"
      />
      <div className="flex items-center gap-1.5 ml-auto">
        <button onClick={onSave} disabled={isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar
        </button>
        <button onClick={onCancel} disabled={isPending}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function ReglasClient({ prepagas, reglas }: {
  prepagas: { id: string; nombre: string }[]
  reglas: ReglaComision[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Clave de la fila en edición: id de regla existente, o `nueva-${prepagaId}` para el alta
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [eliminar, setEliminar] = useState<ReglaComision | null>(null)

  function abrirNueva(prepagaId: string) {
    setForm(FORM_VACIO)
    setEditando(`nueva-${prepagaId}`)
  }

  function abrirEdicion(regla: ReglaComision) {
    setForm({
      id: regla.id,
      segmento: regla.segmento,
      origen: regla.origen ?? '',
      tipo_base: regla.tipo_base,
      porcentaje: String(regla.porcentaje),
      notas: regla.notas ?? '',
    })
    setEditando(regla.id)
  }

  function guardar(prepagaId: string) {
    if (form.porcentaje === '' || isNaN(Number(form.porcentaje))) {
      toast.error('Ingresá un porcentaje válido')
      return
    }
    startTransition(async () => {
      const res = await guardarReglaComision({
        id: form.id,
        prepaga_id: prepagaId,
        segmento: form.segmento,
        origen: (form.origen || null) as ReglaComision['origen'],
        tipo_base: form.tipo_base,
        porcentaje: Number(form.porcentaje),
        notas: form.notas || null,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success(form.id ? 'Regla actualizada' : 'Regla creada')
      setEditando(null)
      router.refresh()
    })
  }

  function confirmarEliminar() {
    if (!eliminar) return
    startTransition(async () => {
      const res = await eliminarReglaComision(eliminar.id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Regla eliminada. Las comisiones ya generadas conservan su snapshot.')
      router.refresh()
    })
    setEliminar(null)
  }

  return (
    <div className="space-y-4">
      {prepagas.map(prepaga => {
        const reglasPrepaga = reglas
          .filter(r => r.prepaga_id === prepaga.id)
          .sort((a, b) => a.segmento.localeCompare(b.segmento) || (a.origen ?? '').localeCompare(b.origen ?? ''))

        return (
          <div key={prepaga.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
              <p className="font-bold text-sm text-slate-900 dark:text-white">{prepaga.nombre}</p>
              <button onClick={() => abrirNueva(prepaga.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar regla
              </button>
            </div>

            {reglasPrepaga.length === 0 && editando !== `nueva-${prepaga.id}` && (
              <p className="px-4 py-3 text-xs text-slate-400">
                Sin reglas: las altas aprobadas de esta prepaga no generan comisión hasta que cargues una.
              </p>
            )}

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {reglasPrepaga.map(regla => (
                editando === regla.id ? (
                  <ReglaForm key={regla.id} form={form} setForm={setForm}
                    onSave={() => guardar(prepaga.id)} onCancel={() => setEditando(null)} isPending={isPending} />
                ) : (
                  <div key={regla.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{SEGMENTO_LABEL[regla.segmento]}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${regla.origen
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                        {regla.origen ? origenLabel(regla.origen) : 'General'}
                      </span>
                      <span className="text-xs text-slate-400">{TIPO_BASE_LABEL[regla.tipo_base]}</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{regla.porcentaje}%</span>
                      {regla.notas && <span className="text-xs text-slate-400 truncate max-w-[280px]" title={regla.notas}>{regla.notas}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => abrirEdicion(regla)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEliminar(regla)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              ))}

              {editando === `nueva-${prepaga.id}` && (
                <ReglaForm form={form} setForm={setForm}
                  onSave={() => guardar(prepaga.id)} onCancel={() => setEditando(null)} isPending={isPending} />
              )}
            </div>
          </div>
        )
      })}

      <AlertDialog
        isOpen={eliminar !== null}
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar regla de comisión"
        description={eliminar
          ? `Se elimina la regla ${SEGMENTO_LABEL[eliminar.segmento]} · ${eliminar.origen ? origenLabel(eliminar.origen) : 'General'} (${eliminar.porcentaje}%). Las próximas altas de ese segmento no generarán comisión si no queda otra regla que aplique.`
          : ''}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
