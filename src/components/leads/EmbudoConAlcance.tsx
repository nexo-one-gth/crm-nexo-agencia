'use client'

import { useMemo, useState, type ComponentProps } from 'react'
import { User, Users, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeadFunnelBoard } from './LeadFunnelBoard'

type Alcance = 'propias' | 'equipo' | 'agencia'

const ALCANCE_LABEL: Record<Alcance, string> = {
  propias: 'Mi cartera',
  equipo: 'Mi equipo',
  agencia: 'Toda la agencia',
}

type LeadFunnelBoardProps = ComponentProps<typeof LeadFunnelBoard>

interface Props extends Omit<LeadFunnelBoardProps, 'initialLeads'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[]
  userId: string
  // Los asesores a cargo salen de la RELACIÓN (admin_asesores), no del rol —
  // mismo criterio que en /altas y /equipo. Es lo que permite que alguien
  // admin, líder y vendedor a la vez tenga las tres vistas sin ninguna rama
  // especial por rol.
  misAsesoresIds: string[]
}

// Envoltorio delgado sobre LeadFunnelBoard: agrega el selector de alcance y
// filtra qué leads llegan al tablero, sin tocar el Kanban/DnD/realtime de
// adentro. LeadFunnelBoard sigue recibiendo initialLeads como siempre —
// simplemente ahora es un subconjunto ya filtrado en vez del total.
export function EmbudoConAlcance({ leads, userId, misAsesoresIds, ...boardProps }: Props) {
  const miEquipoIds = useMemo(() => new Set([userId, ...misAsesoresIds]), [userId, misAsesoresIds])

  const tengoPropias = leads.some(l => l.assigned_to === userId)
  const tengoEquipo = misAsesoresIds.length > 0
  // El pool sin asignar (assigned_to null) y los leads de otros equipos solo
  // cuentan para habilitar "Toda la agencia" — no son ni tu cartera ni la de
  // tu equipo todavía.
  const hayFueraDeMiEquipo = leads.some(l => !l.assigned_to || !miEquipoIds.has(l.assigned_to))

  const alcancesDisponibles = useMemo(() => {
    const lista: Alcance[] = []
    if (tengoPropias) lista.push('propias')
    if (tengoEquipo) lista.push('equipo')
    if (hayFueraDeMiEquipo) lista.push('agencia')
    return lista
  }, [tengoPropias, tengoEquipo, hayFueraDeMiEquipo])

  const alcanceInicial: Alcance = hayFueraDeMiEquipo ? 'agencia' : tengoEquipo ? 'equipo' : 'propias'
  const [alcance, setAlcance] = useState<Alcance>(alcanceInicial)

  const leadsPorAlcance = useMemo(() => {
    if (alcance === 'propias') return leads.filter(l => l.assigned_to === userId)
    if (alcance === 'equipo') return leads.filter(l => l.assigned_to && miEquipoIds.has(l.assigned_to))
    return leads
  }, [leads, alcance, userId, miEquipoIds])

  return (
    <div className="space-y-4">
      {alcancesDisponibles.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
          {alcancesDisponibles.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAlcance(a)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5',
                alcance === a
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {a === 'propias' && <User className="w-3.5 h-3.5" />}
              {a === 'equipo' && <Users className="w-3.5 h-3.5" />}
              {a === 'agencia' && <Building2 className="w-3.5 h-3.5" />}
              {ALCANCE_LABEL[a]}
            </button>
          ))}
        </div>
      )}

      <LeadFunnelBoard
        {...boardProps}
        initialLeads={leadsPorAlcance}
        ocultarColumnaSinAsignar={alcance === 'propias'}
      />
    </div>
  )
}
