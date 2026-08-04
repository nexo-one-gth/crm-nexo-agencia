'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Copy, RefreshCw, ExternalLink, Check } from 'lucide-react'
import { generarResumenAlta } from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'

export function ResumenTramite({
  altaId,
  resumenInicial,
  driveUrlInicial,
}: {
  altaId: string
  resumenInicial: string | null
  driveUrlInicial: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [texto, setTexto] = useState(resumenInicial ?? '')
  const [driveUrl, setDriveUrl] = useState(driveUrlInicial ?? '')
  const [copiado, setCopiado] = useState(false)

  function generar() {
    startTransition(async () => {
      const res = await generarResumenAlta(altaId)
      if (res.error) { toast.error(res.error); return }
      setTexto(res.data?.texto ?? '')
      setDriveUrl(res.data?.driveUrl ?? '')
      toast.success(res.data?.driveUrl ? 'Resumen generado y guardado en Drive' : 'Resumen generado')
      router.refresh()
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          Resumen del trámite
        </h2>
        <button
          onClick={generar}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Generando...' : texto ? 'Regenerar' : 'Generar'}
        </button>
      </div>

      {texto ? (
        <>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-slate-50 dark:bg-white/5 rounded-xl p-4 text-slate-700 dark:text-slate-300 max-h-96 overflow-auto border border-slate-100 dark:border-white/5">
            {texto}
          </pre>
          <div className="flex items-center gap-2">
            <button
              onClick={copiar}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1.5"
            >
              {copiado ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                Ver documento en Drive
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">
          Cargá los datos comerciales y los integrantes, luego generá el resumen para enviar a la prepaga.
        </p>
      )}
    </section>
  )
}
