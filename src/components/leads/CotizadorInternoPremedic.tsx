'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Info } from 'lucide-react'
import { calcularTarifaPremedic } from '@/app/actions/cotizacion-actions'
import type { ResultadoTarifa } from '@/app/actions/cotizacion-actions'
import type { Integrante } from '@/types/cotizacion'

const TASA_APORTES = 0.0765
const IVA_DIRECTO = 10.5

interface Props {
  prepagaId: string
  planes: { id: string; nombre: string }[]
  integrantes: Integrante[]
  onResultado: (total: number, desglose: string, descuentoAportes?: number, iva?: number) => void
}

function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

function rangoEdad(edad: number): string {
  if (edad <= 29) return '1-29 años'
  if (edad <= 39) return '30-39 años'
  if (edad <= 49) return '40-49 años'
  if (edad <= 59) return '50-59 años'
  if (edad <= 64) return '60-64 años'
  return '65+ años'
}

export function CotizadorInternoPremedic({ prepagaId, planes, integrantes, onResultado }: Props) {
  const [zona, setZona] = useState<'amba' | 'interior' | null>(null)
  const [modalidad, setModalidad] = useState<'directo' | 'desregulado'>('directo')
  const [planId, setPlanId] = useState<string>(planes[0]?.id ?? '')
  const [sueldoBruto, setSueldoBruto] = useState('')
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoTarifa | null>(null)

  const titular = integrantes.find(i => i.rol === 'titular')
  const edadTitular = titular?.edad ?? 0

  const descuentoAportesCalculado =
    modalidad === 'desregulado' && sueldoBruto !== '' && Number(sueldoBruto) > 0
      ? Math.round(Number(sueldoBruto) * TASA_APORTES * 100) / 100
      : undefined

  const handleCalcular = async () => {
    if (!zona) { toast.error('Seleccioná una zona antes de calcular'); return }
    if (!planId) { toast.error('Seleccioná un plan'); return }

    setCalculando(true)
    setResultado(null)
    try {
      const res = await calcularTarifaPremedic({ prepaga_id: prepagaId, plan_id: planId, zona, modalidad, integrantes })
      setResultado(res)
      if (res.error) toast.error(res.error)
    } catch {
      toast.error('Error al calcular la tarifa')
    } finally {
      setCalculando(false)
    }
  }

  const handleUsarPrecio = () => {
    if (!resultado || resultado.cotiza_central || resultado.error) return
    const planNombre = planes.find(p => p.id === planId)?.nombre ?? ''
    const desgloseTexto = [
      `Plan ${planNombre} — Zona ${zona?.toUpperCase()} — ${modalidad.charAt(0).toUpperCase() + modalidad.slice(1)}`,
      `Composición: ${resultado.composicion.replace(/_/g, ' ')}`,
      `Titular: ${edadTitular} años (${rangoEdad(edadTitular)})`,
      ...resultado.desglose.map(d => `${d.concepto}: ${formatARS(d.precio)}`),
      `Total base: ${formatARS(resultado.total)}`,
      descuentoAportesCalculado
        ? `Desc. aportes (7,65% de ${formatARS(Number(sueldoBruto))}): ${formatARS(descuentoAportesCalculado)}`
        : '',
      resultado.requiere_auditoria ? 'REQUIERE AUDITORÍA MÉDICA' : '',
    ].filter(Boolean).join('\n')
    const ivaValor = modalidad === 'directo' ? IVA_DIRECTO : 0
    onResultado(resultado.total, desgloseTexto, descuentoAportesCalculado, ivaValor)
    toast.success('Precio cargado en la cotización')
  }

  const RadioGroup = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string
    options: { value: string; label: string }[]
    value: string | null
    onChange: (v: string) => void
  }) => (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-black transition-all ${
              value === opt.value
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:border-indigo-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 space-y-4">
      <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Cotizador Premedic</p>

      <RadioGroup
        label="Zona"
        options={[{ value: 'amba', label: 'AMBA' }, { value: 'interior', label: 'Interior' }]}
        value={zona}
        onChange={v => { setZona(v as 'amba' | 'interior'); setResultado(null) }}
      />

      <RadioGroup
        label="Modalidad"
        options={[{ value: 'directo', label: 'Directo' }, { value: 'desregulado', label: 'Desregulado' }]}
        value={modalidad}
        onChange={v => { setModalidad(v as 'directo' | 'desregulado'); setSueldoBruto(''); setResultado(null) }}
      />

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</p>
        <select
          value={planId}
          onChange={e => { setPlanId(e.target.value); setResultado(null) }}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {planes.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Sueldo bruto — solo para desregulado */}
      {modalidad === 'desregulado' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sueldo Bruto</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={sueldoBruto}
              onChange={e => setSueldoBruto(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          {descuentoAportesCalculado !== undefined && (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
              Desc. aportes (7,65%){' '}
              <span className="font-black text-indigo-600 dark:text-indigo-400">
                {formatARS(descuentoAportesCalculado)}
              </span>
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleCalcular}
        disabled={!zona || calculando}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black transition-colors"
      >
        {calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Calcular precio
      </button>

      {/* Resultado */}
      {resultado && !resultado.error && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          {resultado.cotiza_central ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-black uppercase tracking-widest text-amber-600">Cotiza Central</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Este caso debe cotizarse directamente con Premedic Central. Contactar al administrador.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Composición</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">
                  {resultado.composicion.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Edad titular</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {edadTitular} años ({rangoEdad(edadTitular)})
                </p>
              </div>

              <hr className="border-slate-100 dark:border-white/5" />

              {/* Desglose tarifa */}
              <div className="space-y-2">
                {resultado.desglose.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 capitalize">{d.concepto.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{formatARS(d.precio)}</span>
                  </div>
                ))}

                {/* Descuento aportes desregulado */}
                {descuentoAportesCalculado !== undefined && (
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-dashed border-slate-200 dark:border-white/10">
                    <span className="text-slate-500 dark:text-slate-400">Desc. aportes (7,65%)</span>
                    <span className="font-bold text-emerald-600">− {formatARS(descuentoAportesCalculado)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">TOTAL BASE</span>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatARS(resultado.total)}</span>
                </div>

                {/* IVA info */}
                <div className={`flex items-center justify-between text-xs font-bold px-1 ${modalidad === 'directo' ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <span>IVA</span>
                  <span>{modalidad === 'directo' ? '10,5% (se aplicará al guardar)' : 'No aplica — Desregulado'}</span>
                </div>
              </div>

              {resultado.requiere_auditoria && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Plan {planes.find(p => p.id === planId)?.nombre} mayores de 59: requiere auditoría médica.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleUsarPrecio}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors"
              >
                Usar este precio en la cotización
              </button>
            </div>
          )}
        </div>
      )}

      {resultado?.error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
          <p className="text-xs font-bold text-rose-600">{resultado.error}</p>
        </div>
      )}
    </div>
  )
}
