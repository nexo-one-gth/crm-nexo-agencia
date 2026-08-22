'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, FileText, Users, User, Building2 } from 'lucide-react'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChecklistProgress } from '@/components/prepagas/ChecklistProgress'
import { ESTADO_ALTA_BADGE, getEstadoAltaBadge } from '@/lib/altas-estado'
import type { AltaTableroRow, AltasTablero as Datos } from '@/app/actions/prepaga-actions'
import type { EstadoAlta } from '@/app/actions/prepaga-actions'
import { cn } from '@/lib/utils'

// El orden del ciclo, no el alfabético: así la barra de contadores se lee como
// el recorrido real del trámite y no como una lista de opciones sueltas.
const CICLO: EstadoAlta[] = ['en_proceso', 'enviada', 'observada', 'aprobada', 'rechazada']

type Alcance = 'propias' | 'equipo' | 'agencia'

const ALCANCE_LABEL: Record<Alcance, string> = {
  propias: 'Mi cartera',
  equipo: 'Mi equipo',
  agencia: 'Toda la agencia',
}

const money = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

// Un trámite parado es el dato que un líder necesita ver de un vistazo. Solo
// tiene sentido en los estados vivos: una venta aprobada hace 40 días no está
// frenada, está cerrada.
const ESTADOS_VIVOS = new Set<string>(['en_proceso', 'enviada', 'observada'])

function diasEnCurso(alta: AltaTableroRow): number | null {
  if (!ESTADOS_VIVOS.has(alta.estado)) return null
  const desde = alta.estado === 'en_proceso' ? alta.created_at : (alta.enviada_at ?? alta.created_at)
  return differenceInCalendarDays(new Date(), new Date(desde))
}

function Totales({ altas }: { altas: AltaTableroRow[] }) {
  const conCuota = altas.filter(a => a.cuota !== null)
  const suma = conCuota.reduce((acc, a) => acc + (a.cuota ?? 0), 0)

  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
      {altas.length} {altas.length === 1 ? 'alta' : 'altas'}
      {/* Sin cuota cargada la suma es engañosa: se aclara en vez de mostrar $0. */}
      {conCuota.length > 0
        ? <> · <span className="font-semibold text-slate-700 dark:text-slate-300">{money(suma)}</span>
            {conCuota.length < altas.length && (
              <span className="text-slate-400"> ({altas.length - conCuota.length} sin cuota)</span>
            )}
          </>
        : <span className="text-slate-400"> · sin cuota cargada</span>}
    </span>
  )
}

function FilaAlta({ alta, mostrarAsesor }: { alta: AltaTableroRow; mostrarAsesor: boolean }) {
  const badge = getEstadoAltaBadge(alta.estado)
  const dias = diasEnCurso(alta)

  return (
    <Link
      href={`/altas/${alta.id}`}
      className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 hover:shadow-md transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-slate-900 dark:text-white">{alta.lead_nombre}</p>
          <span className="text-xs text-slate-400">—</span>
          <p className="text-sm text-slate-600 dark:text-slate-400">{alta.prepaga_nombre}</p>
          {alta.plan_nombre && (
            <>
              <span className="text-xs text-slate-400">·</span>
              <p className="text-xs text-slate-500">{alta.plan_nombre}</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
          {mostrarAsesor && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User className="w-3 h-3" />
              {alta.asesor_nombre}
            </span>
          )}
          {alta.cuota !== null && (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {money(alta.cuota)}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {format(new Date(alta.created_at), 'd MMM yyyy', { locale: es })}
          </span>
          {dias !== null && dias >= 7 && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                dias >= 15
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              )}
            >
              {dias} días sin avanzar
            </span>
          )}
        </div>

        {alta.requeridos > 0 && (
          <div className="mt-2 max-w-xs">
            <ChecklistProgress
              totalRequeridos={alta.requeridos}
              completados={alta.completados}
              totalItems={alta.requeridos}
              showDetail={false}
              size="sm"
            />
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
    </Link>
  )
}

function GrupoAsesor({ nombre, altas }: { nombre: string; altas: AltaTableroRow[] }) {
  const [abierto, setAbierto] = useState(true)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
      >
        {abierto ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <User className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">{nombre}</span>
        <Totales altas={altas} />
      </button>

      {abierto && (
        <div className="space-y-2 pl-4 sm:pl-7">
          {altas.map(a => <FilaAlta key={a.id} alta={a} mostrarAsesor={false} />)}
        </div>
      )}
    </div>
  )
}

function agruparPorAsesor(altas: AltaTableroRow[]) {
  const mapa = new Map<string, { nombre: string; altas: AltaTableroRow[] }>()
  for (const a of altas) {
    const actual = mapa.get(a.asesor_id) ?? { nombre: a.asesor_nombre, altas: [] }
    actual.altas.push(a)
    mapa.set(a.asesor_id, actual)
  }
  return [...mapa.values()].sort((x, y) => y.altas.length - x.altas.length)
}

function GrupoLider({ nombre, altas }: { nombre: string; altas: AltaTableroRow[] }) {
  const [abierto, setAbierto] = useState(true)
  const porAsesor = useMemo(() => agruparPorAsesor(altas), [altas])

  return (
    <section className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        {abierto ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <Users className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{nombre}</span>
        <Totales altas={altas} />
      </button>

      {abierto && (
        <div className="space-y-3">
          {porAsesor.map(g => <GrupoAsesor key={g.nombre} nombre={g.nombre} altas={g.altas} />)}
        </div>
      )}
    </section>
  )
}

export function AltasTablero({ datos }: { datos: Datos }) {
  const { rows, userId, misAsesoresIds } = datos

  // Qué alcances existen se decide por el DATO, no por el rol: "Mi equipo"
  // aparece si tenés gente a cargo, "Toda la agencia" si el RLS te está
  // dejando ver algo que no es tuyo ni de tu equipo. Un admin sin equipo no
  // ve una pestaña vacía, y una vendedora con equipo ve las tres.
  const miEquipoIds = useMemo(() => new Set([userId, ...misAsesoresIds]), [userId, misAsesoresIds])
  const tengoPropias = rows.some(a => a.asesor_id === userId)
  const tengoEquipo = misAsesoresIds.length > 0
  const hayFueraDeMiEquipo = rows.some(a => !miEquipoIds.has(a.asesor_id))

  const alcancesDisponibles = useMemo(() => {
    const lista: Alcance[] = []
    if (tengoPropias) lista.push('propias')
    if (tengoEquipo) lista.push('equipo')
    if (hayFueraDeMiEquipo) lista.push('agencia')
    return lista
  }, [tengoPropias, tengoEquipo, hayFueraDeMiEquipo])

  const alcanceInicial: Alcance = hayFueraDeMiEquipo ? 'agencia' : tengoEquipo ? 'equipo' : 'propias'
  const [alcance, setAlcance] = useState<Alcance>(alcanceInicial)
  const [estado, setEstado] = useState<EstadoAlta | null>(null)

  const porAlcance = useMemo(() => {
    if (alcance === 'propias') return rows.filter(a => a.asesor_id === userId)
    if (alcance === 'equipo') return rows.filter(a => miEquipoIds.has(a.asesor_id))
    return rows
  }, [rows, alcance, userId, miEquipoIds])

  // Los contadores del ciclo se calculan sobre el alcance y no sobre el filtro
  // de estado, o al tocar uno los demás se irían a cero.
  const conteos = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of porAlcance) c[a.estado] = (c[a.estado] ?? 0) + 1
    return c
  }, [porAlcance])

  const visibles = useMemo(
    () => (estado ? porAlcance.filter(a => a.estado === estado) : porAlcance),
    [porAlcance, estado]
  )

  const porLider = useMemo(() => {
    const mapa = new Map<string, { nombre: string; altas: AltaTableroRow[] }>()
    for (const a of visibles) {
      const clave = a.lider_id ?? '__sin_equipo__'
      const actual = mapa.get(clave) ?? { nombre: a.lider_nombre ?? 'Sin equipo asignado', altas: [] }
      actual.altas.push(a)
      mapa.set(clave, actual)
    }
    return [...mapa.values()].sort((x, y) => y.altas.length - x.altas.length)
  }, [visibles])

  const porAsesor = useMemo(() => agruparPorAsesor(visibles), [visibles])

  return (
    <div className="space-y-5">
      {/* Selector de alcance */}
      {alcancesDisponibles.length > 1 && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
          {alcancesDisponibles.map(a => (
            <button
              key={a}
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

      {/* Ciclo del trámite: contadores que filtran */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEstado(null)}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
            estado === null
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300'
          )}
        >
          Todas <span className="tabular-nums opacity-70">{porAlcance.length}</span>
        </button>

        {CICLO.map(e => {
          const n = conteos[e] ?? 0
          const activo = estado === e
          return (
            <button
              key={e}
              onClick={() => setEstado(activo ? null : e)}
              disabled={n === 0 && !activo}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                activo
                  ? `${ESTADO_ALTA_BADGE[e].color} border-transparent ring-2 ring-offset-1 ring-slate-300 dark:ring-slate-600 dark:ring-offset-slate-950`
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300'
              )}
            >
              {ESTADO_ALTA_BADGE[e].label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {estado
              ? `Sin altas en estado "${ESTADO_ALTA_BADGE[estado].label}"`
              : 'Sin altas en este alcance'}
          </p>
          {estado && (
            <button
              onClick={() => setEstado(null)}
              className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todas
            </button>
          )}
        </div>
      ) : alcance === 'agencia' ? (
        <div className="space-y-4">
          {porLider.map(g => <GrupoLider key={g.nombre} nombre={g.nombre} altas={g.altas} />)}
        </div>
      ) : alcance === 'equipo' ? (
        // Dentro de "Mi equipo" el líder es siempre el mismo, así que el nivel
        // de líder sería una caja con una sola caja adentro: se agrupa directo
        // por asesor, que es el corte que acá informa algo.
        <div className="space-y-3">
          {porAsesor.map(g => <GrupoAsesor key={g.nombre} nombre={g.nombre} altas={g.altas} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(a => <FilaAlta key={a.id} alta={a} mostrarAsesor={false} />)}
        </div>
      )}
    </div>
  )
}
