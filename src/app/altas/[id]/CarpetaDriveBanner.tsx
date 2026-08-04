'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { FolderOpen, FolderPlus, ExternalLink } from 'lucide-react'
import { crearCarpetaAlta } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'

export function CarpetaDriveBanner({
  altaId,
  driveFolderUrl,
}: {
  altaId: string
  driveFolderUrl: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function crear() {
    startTransition(async () => {
      const res = await crearCarpetaAlta(altaId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Carpeta creada en Drive')
      router.refresh()
    })
  }

  if (driveFolderUrl) {
    return (
      <a
        href={driveFolderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-500/20 p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
      >
        <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Carpeta del trámite en Drive</p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Toda la documentación de esta alta</p>
        </div>
        <ExternalLink className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    )
  }

  return (
    <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-500/20 p-4">
      <FolderPlus className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Sin carpeta en Drive</p>
        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Creá la carpeta para subir documentación</p>
      </div>
      <button
        onClick={crear}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 shrink-0"
      >
        {isPending ? 'Creando...' : 'Crear carpeta'}
      </button>
    </div>
  )
}
