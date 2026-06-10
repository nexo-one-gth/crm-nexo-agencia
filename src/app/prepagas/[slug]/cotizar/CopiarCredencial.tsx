'use client'

import { useState } from 'react'
import { Copy, Check, Eye, EyeOff } from 'lucide-react'

interface CopiarCredencialProps {
  label: string
  valor: string
  ocultarValor?: boolean
}

export function CopiarCredencial({ label, valor, ocultarValor = false }: CopiarCredencialProps) {
  const [copiado, setCopiado] = useState(false)
  const [visible, setVisible] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="text-xs text-amber-600 dark:text-amber-500">{label}</p>
        <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
          {ocultarValor && !visible ? '••••••••' : valor}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {ocultarValor && (
          <button
            onClick={() => setVisible(v => !v)}
            className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            title={visible ? 'Ocultar' : 'Mostrar'}
          >
            {visible ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-amber-600" />}
          </button>
        )}
        <button
          onClick={copiar}
          className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          title="Copiar"
        >
          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
        </button>
      </div>
    </div>
  )
}
