'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DollarSign, Plus, Trash2, ExternalLink, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, Rocket, Building2, Copy, Check, KeyRound
} from 'lucide-react'
import { useCotizacion } from '@/hooks/useCotizacion'
import { iniciarAltaDesdeCotizacion, getCotizadorAcceso } from '@/app/actions/cotizacion-actions'
import type { Integrante, LeadCotizacion, PrepagaConCotizador, CotizadorAcceso, PdfListado } from '@/types/cotizacion'

interface PanelCotizacionProps {
  leadId: string
  stageName: string
}

const ROL_LABELS: Record<Integrante['rol'], string> = {
  titular: 'Titular',
  conyuge: 'Cónyuge',
  hijo: 'Hijo/a',
  otro: 'Otro',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function calcularValorFinal(
  valorCalculado: number,
  descuentoAportes: number,
  descuentoComercial: number,
  iva: number
): number {
  const base = valorCalculado - descuentoAportes - descuentoComercial
  return base + base * (iva / 100)
}

function formatARS(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

// ---------------------------------------------------------------------------
// Subcomponente: Fila de credencial con copy-to-clipboard
// ---------------------------------------------------------------------------
function CredencialRow({ label, value }: { label: string; value: string | null }) {
  const [copiado, setCopiado] = useState(false)
  if (!value) return null
  const copiar = async () => {
    await navigator.clipboard.writeText(value)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
        title="Copiar"
      >
        {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: Card de prepaga seleccionable
// ---------------------------------------------------------------------------
function PrepagaCard({
  prepaga,
  seleccionada,
  onClick,
}: {
  prepaga: PrepagaConCotizador
  seleccionada: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left w-full ${
        seleccionada
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
          : 'border-white/20 bg-white/50 dark:bg-white/5 hover:border-indigo-300 dark:hover:border-indigo-700'
      }`}
    >
      {prepaga.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prepaga.logo_url} alt={prepaga.nombre} className="w-10 h-10 object-contain rounded-lg" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-black text-sm truncate">{prepaga.nombre}</p>
        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
          {prepaga.tipo_cotizador === 'integrado' ? 'Cotizador interno' :
           prepaga.tipo_cotizador === 'externo' ? 'Cotizador externo' :
           prepaga.tipo_cotizador === 'pdf' ? 'Cotizador PDF' : 'Manual'}
        </p>
      </div>
      {seleccionada && <CheckCircle2 className="w-5 h-5 text-indigo-500 ml-auto shrink-0" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: Formulario de integrantes
// ---------------------------------------------------------------------------
function FormIntegrantes({
  integrantes,
  onChange,
}: {
  integrantes: Integrante[]
  onChange: (v: Integrante[]) => void
}) {
  const actualizar = (idx: number, campo: keyof Integrante, valor: string | number) => {
    const copia = [...integrantes]
    copia[idx] = { ...copia[idx], [campo]: valor }
    onChange(copia)
  }

  const agregar = () =>
    onChange([...integrantes, { rol: 'hijo', edad: 0 }])

  const eliminar = (idx: number) => {
    if (idx === 0) return
    onChange(integrantes.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Grupo Familiar</h4>
        <button
          type="button"
          onClick={agregar}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar integrante
        </button>
      </div>
      {integrantes.map((int, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <select
            value={int.rol}
            onChange={e => actualizar(idx, 'rol', e.target.value)}
            disabled={idx === 0}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {Object.entries(ROL_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={99}
              value={int.edad}
              onChange={e => actualizar(idx, 'edad', Number(e.target.value))}
              className="w-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <span className="text-xs text-slate-400 font-bold">años</span>
          </div>
          {idx > 0 ? (
            <button
              type="button"
              onClick={() => eliminar(idx)}
              className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: Resultado cotización
// ---------------------------------------------------------------------------
function FormResultado({
  valorCalculado, descuentoAportes, descuentoComercial, iva, valorFinal, observaciones,
  onChange,
}: {
  valorCalculado: string
  descuentoAportes: string
  descuentoComercial: string
  iva: string
  valorFinal: number | null
  observaciones: string
  onChange: (campo: string, valor: string) => void
}) {
  const campo = (label: string, key: string, valor: string, prefijo?: string) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      <div className="relative">
        {prefijo && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{prefijo}</span>
        )}
        <input
          type="number"
          min={0}
          step="0.01"
          value={valor}
          onChange={e => onChange(key, e.target.value)}
          className={`w-full ${prefijo ? 'pl-8' : 'px-3'} pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Resultado</h4>
      <div className="grid grid-cols-2 gap-4">
        {campo('Valor Calculado', 'valorCalculado', valorCalculado, '$')}
        {campo('Desc. Aportes %', 'descuentoAportes', descuentoAportes)}
        {campo('Desc. Comercial %', 'descuentoComercial', descuentoComercial)}
        {campo('IVA %', 'iva', iva)}
      </div>

      {/* Valor final calculado */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Cuota Final Estimada</p>
        <p className="text-3xl font-black text-emerald-600 tracking-tighter">
          {formatARS(valorFinal)}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={e => onChange('observaciones', e.target.value)}
          rows={3}
          placeholder="Condiciones especiales, aclaraciones, etc."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel principal
// ---------------------------------------------------------------------------
export function PanelCotizacion({ leadId, stageName }: PanelCotizacionProps) {
  const router = useRouter()
  const { prepagasDelAsesor, cotizacionesDelLead, loading, error, guardar, aprobar } = useCotizacion(leadId)

  const [prepagaSeleccionada, setPrepagaSeleccionada] = useState<PrepagaConCotizador | null>(null)
  const [cotizacionActiva, setCotizacionActiva] = useState<LeadCotizacion | null>(null)
  const [expandida, setExpandida] = useState(true)

  // Formulario
  const [integrantes, setIntegrantes] = useState<Integrante[]>([{ rol: 'titular', edad: 0 }])
  const [valorCalculado, setValorCalculado] = useState('')
  const [descuentoAportes, setDescuentoAportes] = useState('')
  const [descuentoComercial, setDescuentoComercial] = useState('')
  const [iva, setIva] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [aprobando, setAprobando] = useState(false)
  const [iniciandoAlta, setIniciandoAlta] = useState(false)
  const [accesoCotizador, setAccesoCotizador] = useState<CotizadorAcceso | null>(null)
  const [cargandoAcceso, setCargandoAcceso] = useState(false)

  // Solo se renderiza en etapa Interesado
  if (stageName !== 'Interesado') return null

  // Sincronizar formulario cuando hay cotizaciones previas
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (cotizacionesDelLead.length > 0 && !cotizacionActiva) {
      const ultima = cotizacionesDelLead[0]
      setCotizacionActiva(ultima)
      setIntegrantes(ultima.integrantes.length > 0 ? ultima.integrantes : [{ rol: 'titular', edad: 0 }])
      setValorCalculado(ultima.valor_calculado?.toString() ?? '')
      setDescuentoAportes(ultima.descuento_aportes?.toString() ?? '')
      setDescuentoComercial(ultima.descuento_comercial?.toString() ?? '')
      setIva(ultima.iva?.toString() ?? '')
      setObservaciones(ultima.observaciones ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacionesDelLead])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (cotizacionActiva && prepagasDelAsesor.length > 0) {
      const p = prepagasDelAsesor.find(p => p.id === cotizacionActiva.prepaga_id)
      if (p) setPrepagaSeleccionada(p)
    }
  }, [cotizacionActiva, prepagasDelAsesor])

  // Limpiar acceso cuando cambia la prepaga; auto-fetch para tipo pdf
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setAccesoCotizador(null)
    if (!prepagaSeleccionada) return
    if (prepagaSeleccionada.tipo_cotizador === 'pdf') {
      setCargandoAcceso(true)
      getCotizadorAcceso(prepagaSeleccionada.id).then(result => {
        setCargandoAcceso(false)
        if (!result.error) setAccesoCotizador(result)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepagaSeleccionada?.id])

  const num = (v: string) => (v === '' ? null : Number(v))

  const valorFinalCalculado = (() => {
    const vc = num(valorCalculado)
    if (vc === null) return null
    const da = num(descuentoAportes) ?? 0
    const dc = num(descuentoComercial) ?? 0
    const iv = num(iva) ?? 0
    return calcularValorFinal(vc, da, dc, iv)
  })()

  const cambioResultado = (campo: string, valor: string) => {
    if (campo === 'valorCalculado') setValorCalculado(valor)
    if (campo === 'descuentoAportes') setDescuentoAportes(valor)
    if (campo === 'descuentoComercial') setDescuentoComercial(valor)
    if (campo === 'iva') setIva(valor)
    if (campo === 'observaciones') setObservaciones(valor)
  }

  const handleAbrirCotizador = async () => {
    if (!prepagaSeleccionada?.cotizador_url) return
    // Abrir URL inmediatamente (antes del await para evitar bloqueo de popups)
    window.open(prepagaSeleccionada.cotizador_url, '_blank', 'noopener,noreferrer')
    setCargandoAcceso(true)
    const result = await getCotizadorAcceso(prepagaSeleccionada.id)
    setCargandoAcceso(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setAccesoCotizador({ url: result.url, usuario: result.usuario, password: result.password })
    }
  }

  const handleGuardar = async () => {
    if (!prepagaSeleccionada) { toast.error('Seleccioná una prepaga'); return }
    setGuardando(true)
    const result = await guardar({
      id: cotizacionActiva?.id,
      lead_id: leadId,
      prepaga_id: prepagaSeleccionada.id,
      integrantes,
      valor_calculado: num(valorCalculado),
      descuento_aportes: num(descuentoAportes),
      descuento_comercial: num(descuentoComercial),
      iva: num(iva),
      valor_final: valorFinalCalculado,
      observaciones: observaciones || null,
      cotizador_tipo: prepagaSeleccionada.tipo_cotizador,
    })
    setGuardando(false)
    if (result) {
      setCotizacionActiva(result)
      toast.success('Cotización guardada')
    } else {
      toast.error('Error al guardar la cotización')
    }
  }

  const handleAprobar = async () => {
    if (!cotizacionActiva) return
    setAprobando(true)
    const result = await aprobar(cotizacionActiva.id)
    setAprobando(false)
    if (result) {
      setCotizacionActiva(result)
      toast.success('Cotización aprobada')
    } else {
      toast.error('Error al aprobar la cotización')
    }
  }

  const handleIniciarAlta = async () => {
    if (!cotizacionActiva) return
    setIniciandoAlta(true)
    const result = await iniciarAltaDesdeCotizacion(cotizacionActiva.id)
    setIniciandoAlta(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Alta iniciada correctamente')
    router.push(`/altas/${result.altaId}`)
  }

  return (
    <div className="rounded-3xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 overflow-hidden">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setExpandida(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">Panel de Cotización</p>
            {cotizacionActiva && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                {cotizacionActiva.estado === 'borrador' ? 'Borrador guardado' :
                 cotizacionActiva.estado === 'aprobada' ? '✓ Cotización aprobada' : 'Enviada'}
              </p>
            )}
          </div>
        </div>
        {expandida ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expandida && (
        <div className="px-6 pb-6 space-y-6">
          {/* Estado cargando */}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-bold">Cargando...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-sm font-bold">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Sin prepagas asignadas */}
              {prepagasDelAsesor.length === 0 ? (
                <div className="py-8 text-center opacity-50 space-y-2">
                  <Building2 className="w-8 h-8 mx-auto" />
                  <p className="text-sm font-bold">No tenés prepagas asignadas</p>
                  <p className="text-xs text-slate-400">Contactá a un administrador para que te asignen prepagas</p>
                </div>
              ) : (
                <>
                  {/* Selección de prepaga */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Elegí una Prepaga</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {prepagasDelAsesor.map(p => (
                        <PrepagaCard
                          key={p.id}
                          prepaga={p}
                          seleccionada={prepagaSeleccionada?.id === p.id}
                          onClick={() => setPrepagaSeleccionada(p)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Panel de cotizador según tipo */}
                  {prepagaSeleccionada && (
                    <>
                      <hr className="border-white/10" />

                      {/* Cotizador externo (ej. Avalian): abre web + muestra credenciales */}
                      {prepagaSeleccionada.tipo_cotizador === 'externo' && (
                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                          <p className="text-xs font-black uppercase tracking-widest text-blue-600">Cotizador Externo</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Abrí el cotizador de {prepagaSeleccionada.nombre}, completá los datos y pegá el resultado acá abajo.
                          </p>
                          {prepagaSeleccionada.cotizador_url && (
                            <button
                              type="button"
                              onClick={handleAbrirCotizador}
                              disabled={cargandoAcceso}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-black transition-colors"
                            >
                              {cargandoAcceso
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <ExternalLink className="w-4 h-4" />}
                              Abrir cotizador {prepagaSeleccionada.nombre}
                            </button>
                          )}
                          {accesoCotizador && (accesoCotizador.usuario || accesoCotizador.password) && (
                            <div className="mt-1 p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Credenciales</p>
                              </div>
                              <CredencialRow label="Usuario" value={accesoCotizador.usuario} />
                              <CredencialRow label="Contraseña" value={accesoCotizador.password} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lista de precios PDF (ej. Premedic): abre cada PDF desde Drive */}
                      {prepagaSeleccionada.tipo_cotizador === 'pdf' && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                          <p className="text-xs font-black uppercase tracking-widest text-amber-600">Lista de Precios</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Abrí la lista correspondiente, buscá el valor por edad/plan y completá el resultado abajo.
                          </p>
                          {cargandoAcceso && (
                            <div className="flex items-center gap-2 text-amber-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-xs font-bold">Cargando listas...</span>
                            </div>
                          )}
                          {!cargandoAcceso && accesoCotizador?.pdfs && accesoCotizador.pdfs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {accesoCotizador.pdfs.map((pdf: PdfListado) => (
                                <a
                                  key={pdf.url}
                                  href={pdf.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  {pdf.label}
                                </a>
                              ))}
                            </div>
                          )}
                          {!cargandoAcceso && (!accesoCotizador?.pdfs || accesoCotizador.pdfs.length === 0) && (
                            <p className="text-xs text-amber-600 font-bold">Sin listas cargadas — contactá al administrador.</p>
                          )}
                        </div>
                      )}

                      {prepagaSeleccionada.tipo_cotizador === 'integrado' && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1">Cotizador Interno</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Cotizador integrado para {prepagaSeleccionada.nombre} — disponible en Fase 2.
                          </p>
                          <p className="text-xs text-amber-600 mt-2 font-bold">
                            Por ahora podés ingresar los valores manualmente abajo.
                          </p>
                        </div>
                      )}

                      <hr className="border-white/10" />

                      {/* Integrantes */}
                      <FormIntegrantes integrantes={integrantes} onChange={setIntegrantes} />

                      <hr className="border-white/10" />

                      {/* Resultado */}
                      <FormResultado
                        valorCalculado={valorCalculado}
                        descuentoAportes={descuentoAportes}
                        descuentoComercial={descuentoComercial}
                        iva={iva}
                        valorFinal={valorFinalCalculado}
                        observaciones={observaciones}
                        onChange={cambioResultado}
                      />

                      <hr className="border-white/10" />

                      {/* Acciones */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleGuardar}
                          disabled={guardando}
                          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-black transition-colors shadow-lg shadow-indigo-500/20"
                        >
                          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Guardar cotización
                        </button>

                        {cotizacionActiva && cotizacionActiva.estado !== 'aprobada' && (
                          <button
                            type="button"
                            onClick={handleAprobar}
                            disabled={aprobando}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-black transition-colors"
                          >
                            {aprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Marcar como aprobada
                          </button>
                        )}

                        {cotizacionActiva?.estado === 'aprobada' && (
                          <button
                            type="button"
                            onClick={handleIniciarAlta}
                            disabled={iniciandoAlta}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 text-white text-sm font-black transition-all shadow-lg shadow-purple-500/20"
                          >
                            {iniciandoAlta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                            Iniciar Alta
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
