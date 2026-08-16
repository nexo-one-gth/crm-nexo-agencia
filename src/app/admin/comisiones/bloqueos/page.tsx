import Link from 'next/link'
import { ArrowLeft, ShieldAlert, CircleSlash, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { getBloqueosComisionales, type Bloqueo } from '@/app/actions/prepaga-actions'

export const metadata = { title: 'Bloqueos comisionales | Admin' }

type Grupo = {
  titulo: string
  explicacion: string
  items: Bloqueo[]
  accion?: { label: string; href: string }
}

// Agrupa por `clave` para que una prepaga con cinco asesores sin porcentaje sea
// una fila con cinco nombres y no cinco filas repitiendo la prepaga.
function porClave(items: Bloqueo[]) {
  const mapa = new Map<string, string[]>()
  for (const i of items) mapa.set(i.clave, [...(mapa.get(i.clave) ?? []), i.detalle])
  return [...mapa.entries()].sort((a, b) => b[1].length - a[1].length)
}

function Seccion({ grupo, severidad }: { grupo: Grupo; severidad: 'frena' | 'distorsiona' }) {
  if (grupo.items.length === 0) return null

  const color = severidad === 'frena'
    ? { borde: 'border-rose-200 dark:border-rose-500/25', fondo: 'bg-rose-50/60 dark:bg-rose-900/10', texto: 'text-rose-700 dark:text-rose-400', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' }
    : { borde: 'border-amber-200 dark:border-amber-500/25', fondo: 'bg-amber-50/60 dark:bg-amber-900/10', texto: 'text-amber-700 dark:text-amber-400', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }

  const grupos = porClave(grupo.items)

  return (
    <section className={`rounded-2xl border ${color.borde} overflow-hidden`}>
      <div className={`px-4 py-3 ${color.fondo} border-b ${color.borde}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className={`font-bold text-sm ${color.texto}`}>{grupo.titulo}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.pill}`}>{grupo.items.length}</span>
            {grupo.accion && (
              <Link href={grupo.accion.href} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                {grupo.accion.label}
              </Link>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{grupo.explicacion}</p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
        {grupos.map(([clave, detalles]) => (
          <div key={clave} className="px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {clave}
              {detalles.length > 1 && <span className="ml-2 text-xs font-normal text-slate-400">{detalles.length} pendientes</span>}
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {detalles.map((d, i) => (
                <li key={i} className="text-xs text-slate-500 dark:text-slate-400">{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function BloqueosPage() {
  const b = await getBloqueosComisionales()

  const frenan: Grupo[] = [
    {
      titulo: 'Asesores sin porcentaje para una prepaga activa',
      explicacion: 'Sin porcentaje no se puede saber cuánto cobra el asesor. El alta se aprueba y no se genera comisión: solo queda una nota en el historial del lead.',
      items: b.asignacionesSinPct,
      accion: { label: 'Ir a Prepagas', href: '/admin/prepagas' },
    },
    {
      titulo: 'Prepagas activas sin ninguna regla comisional',
      explicacion: 'Se pueden vender pero no facturan: cualquier alta aprobada de estas prepagas queda sin comisión.',
      items: b.prepagasActivasSinReglas,
      accion: { label: 'Cargar reglas', href: '/admin/comisiones/reglas' },
    },
    {
      titulo: 'Trámites abiertos sin datos comerciales',
      explicacion: 'Les falta el tipo de alta o la cuota. Sin eso no hay segmento ni base de cálculo, así que van a frenar al momento de aprobarse.',
      items: b.altasSinDatosComerciales,
      accion: { label: 'Ver altas', href: '/altas' },
    },
  ]

  const distorsionan: Grupo[] = [
    {
      titulo: 'Reglas todavía en el valor sembrado',
      explicacion: 'Un 100% significa que NEXO factura exactamente la cuota. Si el asesor también está al 100%, el margen de la agencia es cero.',
      items: b.reglasEnPlaceholder,
      accion: { label: 'Editar reglas', href: '/admin/comisiones/reglas' },
    },
    {
      titulo: 'Líderes sin override cargado',
      explicacion: 'El generador emite el override por relación, no por rol, pero si no hay porcentaje vigente para esa prepaga no emite nada.',
      items: b.lideresSinOverride,
      accion: { label: 'Cargar overrides', href: '/admin/comisiones/overrides' },
    },
    {
      titulo: 'Prepagas desactivadas que conservan reglas',
      explicacion: 'No rompen nada, pero indican que el catálogo y las reglas se editaron por separado. Conviene decidir si vuelven o si las reglas sobran.',
      items: b.prepagasInactivasConReglas,
    },
  ]

  const totalFrena = frenan.reduce((n, g) => n + g.items.length, 0)
  const totalDistorsiona = distorsionan.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div>
        <Link href="/admin/comisiones" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a Comisiones
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          Bloqueos comisionales
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Todo lo que hoy impide generar una comisión o la genera con números irreales. Cuando falta un dato,
          el sistema no falla con un error: aprueba la venta y deja una nota en el historial del lead. Acá se ve antes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
            <CircleSlash className="w-3.5 h-3.5" /> Frenan la comisión
          </p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1 tabular-nums">{totalFrena}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5" /> Distorsionan los números
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">{totalDistorsiona}</p>
        </div>
      </div>

      {totalFrena === 0 && totalDistorsiona === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">No hay nada bloqueando la liquidación</p>
          <p className="text-xs text-slate-400 mt-1">Todas las prepagas activas tienen reglas y todos los asesores asignados tienen porcentaje.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {frenan.map(g => <Seccion key={g.titulo} grupo={g} severidad="frena" />)}
          {distorsionan.map(g => <Seccion key={g.titulo} grupo={g} severidad="distorsiona" />)}
        </div>
      )}
    </div>
  )
}
