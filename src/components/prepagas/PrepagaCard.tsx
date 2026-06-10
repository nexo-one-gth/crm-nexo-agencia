'use client'

import Link from 'next/link'
import { ExternalLink, FileText, Shield } from 'lucide-react'

type Prepaga = {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
  activa: boolean
  tipo_cotizador: string
  cotizador_url: string | null
  orden: number
}

interface PrepagaCardProps {
  prepaga: Prepaga
  planesCount?: number
}

const GRADIENTES: Record<number, string> = {
  0: 'from-blue-500 to-blue-700',
  1: 'from-emerald-500 to-emerald-700',
  2: 'from-purple-500 to-purple-700',
  3: 'from-rose-500 to-rose-700',
  4: 'from-amber-500 to-amber-700',
  5: 'from-cyan-500 to-cyan-700',
  6: 'from-indigo-500 to-indigo-700',
  7: 'from-teal-500 to-teal-700',
  8: 'from-pink-500 to-pink-700',
  9: 'from-orange-500 to-orange-700',
}

export function PrepagaCard({ prepaga, planesCount = 0 }: PrepagaCardProps) {
  const gradiente = GRADIENTES[(prepaga.orden - 1) % 10] ?? 'from-blue-500 to-blue-700'
  const iniciales = prepaga.nombre.split(' ').map(w => w[0]).join('').slice(0, 2)

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/30 transition-all duration-200">
      {/* Header con gradiente */}
      <div className={`h-20 bg-gradient-to-br ${gradiente} flex items-center justify-between px-5`}>
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          {prepaga.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prepaga.logo_url} alt={prepaga.nombre} className="w-10 h-10 object-contain rounded-lg" />
          ) : (
            <span className="text-white font-black text-lg">{iniciales}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {prepaga.tipo_cotizador === 'externo' && prepaga.cotizador_url && (
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Cotizador
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1">
          {prepaga.nombre}
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4">
          {planesCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {planesCount} {planesCount === 1 ? 'plan' : 'planes'}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {prepaga.tipo_cotizador}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <Link
            href={`/prepagas/${prepaga.slug}`}
            className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Ver detalle
          </Link>
          {prepaga.cotizador_url && (
            <Link
              href={`/prepagas/${prepaga.slug}/cotizar`}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
            >
              Cotizar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
