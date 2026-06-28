'use client'

import { ExternalLink } from 'lucide-react'

// URL pública de login de Sancor Salud — la extensión NEXO Autologin Sancor
// (si está instalada) la detecta por dominio y completa el ingreso sola.
// Si no está instalada, el asesor cae en el login normal sin romper nada.
const SANCOR_LOGIN_URL = 'https://abacomui.sancorsalud.com.ar/#/login?returnUrl=%2FseleccionProducto%2Fsalud'

export function BotonCotizarSancor() {
  const handleClick = () => {
    window.open(SANCOR_LOGIN_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-colors shadow-lg shadow-indigo-500/20"
    >
      <ExternalLink className="w-4 h-4" />
      Cotizar en Sancor
    </button>
  )
}
