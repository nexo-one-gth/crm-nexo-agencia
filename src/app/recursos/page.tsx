import type { Metadata } from 'next'
import { FolderOpen } from 'lucide-react'
import { listarContenidoCarpeta } from '@/lib/google-drive'
import { NavegadorDrive } from '@/components/recursos/NavegadorDrive'

export const metadata: Metadata = { title: 'Recursos | Nexo Asesores' }

export default async function RecursosPage() {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

  if (!rootId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <FolderOpen className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 text-sm">Recursos no configurados. Contactá al administrador.</p>
      </div>
    )
  }

  let initialItems: Awaited<ReturnType<typeof listarContenidoCarpeta>> = []
  let errorInicial: string | null = null

  try {
    initialItems = await listarContenidoCarpeta(rootId)
  } catch {
    errorInicial = 'No se pudo conectar con Google Drive.'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800 dark:text-white">Recursos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Accedé a listas de precios, formularios y materiales de cada prepaga.
        </p>
      </div>

      <NavegadorDrive
        initialItems={initialItems}
        rootFolderId={rootId}
        rootName="Recursos"
        errorInicial={errorInicial}
      />
    </div>
  )
}
