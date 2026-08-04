'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2, FileText, RefreshCw, ClipboardPaste, CheckCircle2,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, UploadCloud,
} from 'lucide-react'
import {
  listarTarifariosPremedic,
  previsualizarTarifarioDrive,
  previsualizarTarifarioTexto,
  confirmarTarifario,
  type PreviewTarifario,
  type MesTarifario,
} from '@/app/actions/premedic-tarifas'
import type { TarifaRow } from '@/lib/premedic/parseTarifarioPremedic'

function formatARS(v: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)
}
function comp(label: string): string {
  return label
    .replace('matrimonio_1hijo', 'Matrimonio + 1 hijo')
    .replace('matrimonio_2hijos', 'Matrimonio + 2 hijos')
    .replace('matrimonio_3hijos', 'Matrimonio + 3 hijos')
    .replace('adicional_menor1', 'Adicional menor 1 año')
    .replace('adicional_menor25', 'Adicional menor 25 años')
    .replace(/^individual$/, 'Individual')
    .replace(/^matrimonio$/, 'Matrimonio')
}
function banda(min: number | null, max: number | null): string {
  return min && max ? `${min}-${max}` : '—'
}

interface Props {
  mesesIniciales: MesTarifario[]
  errorInicial?: string
}

export function TarifasPremedicClient({ mesesIniciales, errorInicial }: Props) {
  const [meses, setMeses] = useState<MesTarifario[]>(mesesIniciales)
  const [mesSel, setMesSel] = useState<string | null>(mesesIniciales[0]?.folderId ?? null)
  const [refrescando, setRefrescando] = useState(false)
  const [modoTexto, setModoTexto] = useState(false)
  const [texto, setTexto] = useState('')
  const [fileIdSel, setFileIdSel] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [preview, setPreview] = useState<PreviewTarifario | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [hecho, setHecho] = useState<number | null>(null)

  const pdfs = meses.find(m => m.folderId === mesSel)?.pdfs ?? []

  const refrescar = async () => {
    setRefrescando(true)
    const r = await listarTarifariosPremedic()
    if (r.error) toast.error(r.error)
    else {
      setMeses(r.meses)
      if (!r.meses.some(m => m.folderId === mesSel)) setMesSel(r.meses[0]?.folderId ?? null)
    }
    setRefrescando(false)
  }

  const cargarDesdeDrive = async (fileId: string) => {
    setFileIdSel(fileId); setCargando(true); setPreview(null); setHecho(null)
    const r = await previsualizarTarifarioDrive(fileId)
    if (r.error) toast.error(r.error)
    else setPreview(r.data ?? null)
    setCargando(false)
  }

  const cargarDesdeTexto = async () => {
    if (texto.trim().length < 50) { toast.error('Pegá el texto del PDF (parece muy corto)'); return }
    setCargando(true); setPreview(null); setHecho(null); setFileIdSel(null)
    const r = await previsualizarTarifarioTexto(texto)
    if (r.error) toast.error(r.error)
    else setPreview(r.data ?? null)
    setCargando(false)
  }

  const confirmar = async () => {
    if (!preview) return
    setConfirmando(true)
    const rows: TarifaRow[] = preview.filas.map(f => ({
      plan_nombre: f.plan_nombre,
      zona: preview.zona,
      modalidad: preview.modalidad,
      composicion: f.composicion as TarifaRow['composicion'],
      edad_titular_min: f.edad_titular_min,
      edad_titular_max: f.edad_titular_max,
      precio: f.precio,
      vigencia_desde: preview.vigencia_desde,
    }))
    const r = await confirmarTarifario(rows)
    if (r.error) toast.error(r.error)
    else {
      toast.success(`Tarifario cargado: ${r.insertadas} filas vigentes desde ${preview.vigencia_desde}`)
      setHecho(r.insertadas ?? rows.length)
      setPreview(null); setFileIdSel(null); setTexto('')
    }
    setConfirmando(false)
  }

  const bloqueaConfirmar = !!preview && (preview.planesNoEncontrados.length > 0 || preview.yaCargado)

  return (
    <div className="space-y-6">
      {/* ---------- Origen: Drive o texto ---------- */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600">1 · Elegí la lista del mes</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModoTexto(m => !m)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {modoTexto ? 'Elegir de Drive' : 'Pegar texto'}
            </button>
            {!modoTexto && (
              <button
                type="button"
                onClick={refrescar}
                disabled={refrescando}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refrescando ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            )}
          </div>
        </div>

        {!modoTexto ? (
          <div className="space-y-3">
            {errorInicial && meses.length === 0 && (
              <p className="text-sm text-rose-600 font-semibold">{errorInicial}</p>
            )}
            {meses.length === 0 && !errorInicial && (
              <p className="text-sm text-slate-500">No se encontraron carpetas de tarifario en Drive.</p>
            )}

            {/* Selector de mes */}
            {meses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {meses.map(mes => (
                  <button
                    key={mes.folderId}
                    type="button"
                    onClick={() => { setMesSel(mes.folderId); setPreview(null); setFileIdSel(null) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border-2 transition-all ${
                      mesSel === mes.folderId
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-indigo-300'
                    }`}
                  >
                    {mes.nombre} <span className="opacity-60">({mes.pdfs.length})</span>
                  </button>
                ))}
              </div>
            )}

            {pdfs.map(pdf => (
              <button
                key={pdf.id}
                type="button"
                onClick={() => cargarDesdeDrive(pdf.id)}
                disabled={cargando}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all disabled:opacity-60 ${
                  fileIdSel === pdf.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-white/10 hover:border-indigo-300'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{pdf.nombre}</span>
                {fileIdSel === pdf.id && cargando
                  ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  : <span className="text-[11px] text-slate-400">{pdf.fechaModificacion?.slice(0, 10)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={5}
              placeholder="Pegá acá el texto del PDF de Premedic (incluí la línea 'Vigencia … AMBA - Desregulados')"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              type="button"
              onClick={cargarDesdeTexto}
              disabled={cargando}
              className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black transition-colors"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Interpretar
            </button>
          </div>
        )}
      </div>

      {/* ---------- Confirmación exitosa ---------- */}
      {hecho !== null && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            Listo: {hecho} filas cargadas. El cotizador ya usa los valores nuevos.
          </p>
        </div>
      )}

      {/* ---------- Preview ---------- */}
      {preview && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-indigo-600">2 · Revisá los valores</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Chip>{preview.zona.toUpperCase()}</Chip>
                <Chip>{preview.modalidad}</Chip>
                <Chip>Vigencia {preview.vigencia_desde}</Chip>
                {preview.resumen.variacionPromedio !== null && (
                  <Chip tone="emerald">Var. prom. {preview.resumen.variacionPromedio.toFixed(1)}%</Chip>
                )}
                <Chip tone="slate">{preview.resumen.total} filas</Chip>
              </div>
            </div>
          </div>

          {preview.yaCargado && (
            <Banner tone="amber">
              Ya existe una lista vigente con vigencia {preview.vigencia_desde} para {preview.zona}/{preview.modalidad}. No se puede cargar dos veces el mismo mes.
            </Banner>
          )}
          {preview.planesNoEncontrados.length > 0 && (
            <Banner tone="rose">
              Planes del PDF sin equivalencia en el sistema: {preview.planesNoEncontrados.join(', ')}. Revisá los nombres antes de confirmar.
            </Banner>
          )}
          {preview.warnings.length > 0 && (
            <Banner tone="amber">
              <span className="font-black">Avisos del parser:</span>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Banner>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5">
                  <th className="text-left px-3 py-2">Plan</th>
                  <th className="text-left px-3 py-2">Composición</th>
                  <th className="text-left px-3 py-2">Edad</th>
                  <th className="text-right px-3 py-2">Anterior</th>
                  <th className="text-right px-3 py-2">Nuevo</th>
                  <th className="text-right px-3 py-2">Var.</th>
                </tr>
              </thead>
              <tbody>
                {preview.filas.map((f, i) => (
                  <tr key={i} className={`border-t border-slate-100 dark:border-white/5 ${!f.plan_id ? 'bg-rose-50 dark:bg-rose-950/20' : ''}`}>
                    <td className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{f.plan_nombre}</td>
                    <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{comp(f.composicion)}</td>
                    <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{banda(f.edad_titular_min, f.edad_titular_max)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-400">{f.precio_anterior !== null ? formatARS(f.precio_anterior) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-slate-800 dark:text-slate-100">{formatARS(f.precio)}</td>
                    <td className="px-3 py-1.5 text-right"><VarBadge pct={f.variacion_pct} nuevo={f.precio_anterior === null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setPreview(null); setFileIdSel(null) }}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={confirmando || bloqueaConfirmar}
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-colors"
            >
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar y activar {preview.resumen.total} precios
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'slate' }) {
  const tones = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    slate: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
  }
  return <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${tones[tone]}`}>{children}</span>
}

function Banner({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'rose' }) {
  const tones = {
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
  }
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-semibold ${tones[tone]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

function VarBadge({ pct, nuevo }: { pct: number | null; nuevo: boolean }) {
  if (nuevo) return <span className="text-[11px] font-black text-indigo-500">NUEVO</span>
  if (pct === null) return <span className="text-slate-300">—</span>
  const up = pct > 0.05, down = pct < -0.05
  const cls = up ? 'text-emerald-600' : down ? 'text-rose-600' : 'text-slate-400'
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${cls}`}>
      <Icon className="w-3.5 h-3.5" />{Math.abs(pct).toFixed(1)}%
    </span>
  )
}
