'use client'

import { useState } from 'react'
import {
  FolderOpen, ChevronRight, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Loader2,
} from 'lucide-react'
import type { DriveItem } from '@/lib/google-drive'
import { getRecursosPrepaga } from '@/app/actions/prepaga-actions'
import { ItemArchivo } from '@/components/recursos/ItemArchivo'

type BreadcrumbItem = { id: string; nombre: string }

type Props = {
  prepagaId: string
  prepagaNombre: string
  /** Si true, arranca expandido y carga al montar. Por defecto colapsado (carga al abrir). */
  defaultOpen?: boolean
}

export function RecursosPrepaga({ prepagaId, prepagaNombre, defaultOpen = false }: Props) {
  const [expandida, setExpandida] = useState(defaultOpen)
  const [cargado, setCargado] = useState(false)
  const [rootFolderId, setRootFolderId] = useState<string | null>(null)
  const [sinCarpeta, setSinCarpeta] = useState(false)
  const [items, setItems] = useState<DriveItem[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estaEnRaiz = breadcrumb.length <= 1

  async function cargarRaiz() {
    setLoading(true)
    setError(null)
    const res = await getRecursosPrepaga(prepagaId)
    setLoading(false)
    setCargado(true)
    if (res.error) { setError(res.error); return }
    if (!res.folderId) { setSinCarpeta(true); return }
    setRootFolderId(res.folderId)
    setItems(res.items)
    setBreadcrumb([{ id: res.folderId, nombre: 'Materiales' }])
  }

  async function cargarCarpeta(folderId: string, nuevoBreadcrumb: BreadcrumbItem[]) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/drive/carpeta?folderId=${encodeURIComponent(folderId)}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setItems(data.items)
      setBreadcrumb(nuevoBreadcrumb)
    } catch {
      setError('No se pudo cargar la carpeta. Reintentá.')
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const abrir = !expandida
    setExpandida(abrir)
    if (abrir && !cargado) cargarRaiz()
  }

  function onCarpetaClick(item: DriveItem) {
    cargarCarpeta(item.id, [...breadcrumb, { id: item.id, nombre: item.nombre }])
  }

  function onBreadcrumbClick(index: number) {
    if (index === breadcrumb.length - 1) return
    cargarCarpeta(breadcrumb[index].id, breadcrumb.slice(0, index + 1))
  }

  function reintentar() {
    if (breadcrumb.length === 0) cargarRaiz()
    else cargarCarpeta(breadcrumb[breadcrumb.length - 1].id, breadcrumb)
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 overflow-hidden">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">Materiales / Recursos</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Carpeta de {prepagaNombre} en Drive
            </p>
          </div>
        </div>
        {expandida ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expandida && (
        <div className="px-4 pb-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-bold">Cargando...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-sm text-slate-500">{error}</p>
              <button
                onClick={reintentar}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && sinCarpeta && (
            <p className="text-sm text-slate-400 text-center py-6">
              Esta prepaga no tiene carpeta de materiales cargada todavía.
            </p>
          )}

          {!loading && !error && !sinCarpeta && rootFolderId && (
            <>
              {/* Breadcrumb (solo al navegar dentro de subcarpetas) */}
              {!estaEnRaiz && (
                <nav className="flex items-center gap-1 text-sm flex-wrap">
                  {breadcrumb.map((item, index) => (
                    <span key={item.id} className="flex items-center gap-1">
                      {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      <button
                        onClick={() => onBreadcrumbClick(index)}
                        className={`transition-colors ${
                          index === breadcrumb.length - 1
                            ? 'text-slate-800 dark:text-white font-semibold cursor-default'
                            : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                      >
                        {item.nombre}
                      </button>
                    </span>
                  ))}
                </nav>
              )}

              {items.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Esta carpeta está vacía.</p>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <ItemArchivo
                      key={item.id}
                      item={item}
                      onCarpetaClick={item.esArchivo ? undefined : () => onCarpetaClick(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
