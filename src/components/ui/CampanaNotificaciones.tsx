'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Inbox, UserPlus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import {
  getMisNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type NotificacionUI,
} from '@/app/actions/notificaciones-actions'

type Props = {
  userId: string
  /** Primer render: viene del server component, no de un fetch en el cliente. */
  inicial: NotificacionUI[]
}

export function CampanaNotificaciones({ userId, inicial }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState<NotificacionUI[]>(inicial)
  const [noLeidas, setNoLeidas] = useState(() => inicial.filter(n => !n.leida_at).length)
  const contenedor = useRef<HTMLDivElement>(null)

  const recargar = useCallback(async () => {
    const res = await getMisNotificaciones()
    setItems(res.data)
    setNoLeidas(res.noLeidas)
  }, [])

  // Realtime: el aviso aparece sin recargar la página. El filtro por
  // destinatario ahorra tráfico, pero quien realmente garantiza el
  // aislamiento es la policy de SELECT que Realtime evalúa por suscriptor.
  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(`notificaciones-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `destinatario_id=eq.${userId}` },
        () => { void recargar() }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [userId, recargar])

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!abierto) return
    const onClick = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [abierto])

  const abrirNotificacion = async (n: NotificacionUI) => {
    setAbierto(false)
    if (!n.leida_at) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x))
      setNoLeidas(c => Math.max(0, c - 1))
      await marcarNotificacionLeida(n.id)
    }
    if (n.link) router.push(n.link)
  }

  const marcarTodas = async () => {
    const ahora = new Date().toISOString()
    setItems(prev => prev.map(x => x.leida_at ? x : { ...x, leida_at: ahora }))
    setNoLeidas(0)
    await marcarTodasLeidas()
  }

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
        aria-expanded={abierto}
        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-400"
      >
        <Bell className="w-5 h-5" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl glass-card bg-white/95 dark:bg-slate-900/95 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-white/10">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones</p>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                No tenés notificaciones todavía.
              </p>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void abrirNotificacion(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                    n.leida_at ? '' : 'bg-blue-50/60 dark:bg-blue-500/10'
                  }`}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                    n.tipo === 'leads_para_repartir'
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                  }`}>
                    {n.tipo === 'leads_para_repartir' ? <Inbox className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{n.titulo}</span>
                    {n.cuerpo && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.cuerpo}</span>
                    )}
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </span>
                  {!n.leida_at && <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
