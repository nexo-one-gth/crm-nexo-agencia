'use client'

import { File, FileText, FileSpreadsheet, Folder, Image, ChevronRight, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DriveItem } from '@/lib/google-drive'

type MimeConfig = {
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const MIME_MAP: Record<string, MimeConfig> = {
  'application/vnd.google-apps.folder': { icon: Folder, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  'application/pdf': { icon: FileText, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  'application/vnd.ms-excel': { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  'application/vnd.google-apps.spreadsheet': { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  'application/msword': { icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  'application/vnd.google-apps.document': { icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
}

function getMimeConfig(mimeType: string): MimeConfig {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType]
  if (mimeType.startsWith('image/')) return { icon: Image, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' }
  return { icon: File, color: 'text-slate-400 bg-slate-100 dark:bg-slate-500/10' }
}

type Props = {
  item: DriveItem
  onCarpetaClick?: () => void
}

export function ItemArchivo({ item, onCarpetaClick }: Props) {
  const { icon: Icon, color } = getMimeConfig(item.mimeType)

  const fecha = item.fechaModificacion
    ? format(new Date(item.fechaModificacion), "d MMM yyyy", { locale: es })
    : null

  const inner = (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border bg-white dark:bg-white/5 transition-all duration-200 ${
      onCarpetaClick
        ? 'border-slate-100 dark:border-white/10 hover:border-blue-200 dark:hover:border-blue-500/30 hover:shadow-sm cursor-pointer'
        : 'border-slate-100 dark:border-white/10'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.nombre}</p>
        {fecha && <p className="text-xs text-slate-400 mt-0.5">{fecha}</p>}
      </div>

      {item.esArchivo ? (
        <a
          href={item.urlVista}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
        >
          Abrir <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      )}
    </div>
  )

  if (onCarpetaClick) {
    return (
      <button onClick={onCarpetaClick} className="w-full text-left">
        {inner}
      </button>
    )
  }

  return inner
}
