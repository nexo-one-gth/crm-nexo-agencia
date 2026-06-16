'use client'

import { useState } from 'react'
import { ChevronRight, RefreshCw, AlertCircle, FolderOpen } from 'lucide-react'
import type { DriveItem } from '@/lib/google-drive'
import { ItemArchivo } from './ItemArchivo'

const PREPAGA_GRADIENTS = [
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-emerald-700',
  'from-violet-500 to-violet-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
  'from-cyan-500 to-cyan-700',
  'from-indigo-500 to-indigo-700',
  'from-teal-500 to-teal-700',
]

type BreadcrumbItem = { id: string; nombre: string }

type Props = {
  initialItems: DriveItem[]
  rootFolderId: string
  rootName: string
  errorInicial: string | null
}

export function NavegadorDrive({ initialItems, rootFolderId, rootName, errorInicial }: Props) {
  const [items, setItems] = useState<DriveItem[]>(initialItems)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: rootFolderId, nombre: rootName }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(errorInicial)

  const estaEnRaiz = breadcrumb.length === 1

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
      setError('No se pudo cargar la carpeta. Chequeá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function onCarpetaClick(item: DriveItem) {
    cargarCarpeta(item.id, [...breadcrumb, { id: item.id, nombre: item.nombre }])
  }

  function onBreadcrumbClick(index: number) {
    if (index === breadcrumb.length - 1) return
    cargarCarpeta(breadcrumb[index].id, breadcrumb.slice(0, index + 1))
  }

  function reintentar() {
    const actual = breadcrumb[breadcrumb.length - 1]
    cargarCarpeta(actual.id, breadcrumb)
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-white/5 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Error al cargar recursos</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
        </div>
        <button
          onClick={reintentar}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb — solo se muestra cuando se navega dentro de una carpeta */}
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

      {/* Vista raíz: grid de cards por prepaga */}
      {estaEnRaiz && (
        <>
          {items.filter(i => !i.esArchivo).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <FolderOpen className="w-10 h-10 text-slate-300" />
              <p className="text-slate-500 text-sm">No hay carpetas disponibles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.filter(i => !i.esArchivo).map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => onCarpetaClick(item)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-200 text-center"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${PREPAGA_GRADIENTS[index % PREPAGA_GRADIENTS.length]} flex items-center justify-center shadow-sm`}>
                    <FolderOpen className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight line-clamp-2">
                    {item.nombre}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Vista interior: lista de archivos y subcarpetas */}
      {!estaEnRaiz && (
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <FolderOpen className="w-10 h-10 text-slate-300" />
              <p className="text-slate-500 text-sm">Esta carpeta está vacía.</p>
            </div>
          ) : (
            items.map(item => (
              <ItemArchivo
                key={item.id}
                item={item}
                onCarpetaClick={item.esArchivo ? undefined : () => onCarpetaClick(item)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
