'use client'

import Link from 'next/link'
import { Eye, Calculator, ExternalLink, FileText } from 'lucide-react'

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

const ACCENT_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: '#1e3a8a', border: '#3b82f6', text: '#93c5fd' },
  1: { bg: '#064e3b', border: '#10b981', text: '#6ee7b7' },
  2: { bg: '#3b0764', border: '#8b5cf6', text: '#c4b5fd' },
  3: { bg: '#7c2d12', border: '#f43f5e', text: '#fda4af' },
  4: { bg: '#78350f', border: '#f59e0b', text: '#fcd34d' },
  5: { bg: '#164e63', border: '#06b6d4', text: '#67e8f9' },
  6: { bg: '#312e81', border: '#6366f1', text: '#a5b4fc' },
  7: { bg: '#134e4a', border: '#14b8a6', text: '#5eead4' },
  8: { bg: '#831843', border: '#ec4899', text: '#f9a8d4' },
  9: { bg: '#7c2d12', border: '#f97316', text: '#fdba74' },
}

export function PrepagaCard({ prepaga, planesCount = 0 }: PrepagaCardProps) {
  const colors = ACCENT_COLORS[(prepaga.orden - 1) % 10] ?? ACCENT_COLORS[0]
  const iniciales = prepaga.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const hasCotizador = !!prepaga.cotizador_url

  return (
    <div
      className="group relative flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/15 transition-all duration-200"
      style={{ borderLeft: `3px solid ${colors.border}` }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
        style={{ background: colors.bg, color: colors.text }}
      >
        {prepaga.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={prepaga.logo_url} alt={prepaga.nombre} className="w-8 h-8 object-contain rounded-lg" />
        ) : (
          iniciales
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
          {prepaga.nombre}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {prepaga.tipo_cotizador}
            {planesCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                <FileText className="w-2.5 h-2.5" />
                {planesCount} {planesCount === 1 ? 'plan' : 'planes'}
              </span>
            )}
          </span>
          {hasCotizador && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
              style={{ background: `${colors.border}22`, color: colors.text, border: `1px solid ${colors.border}44` }}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Cotizador
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={`/prepagas/${prepaga.slug}`}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
          title="Ver detalle"
        >
          <Eye className="w-3.5 h-3.5" />
        </Link>
        {hasCotizador && (
          <Link
            href={`/prepagas/${prepaga.slug}/cotizar`}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: `${colors.border}22`, color: colors.text, border: `1px solid ${colors.border}44` }}
            title="Cotizar"
          >
            <Calculator className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}
