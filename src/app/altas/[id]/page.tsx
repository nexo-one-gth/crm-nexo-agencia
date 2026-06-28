import { createClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/supabase/assert-admin'
import { redirect, notFound } from 'next/navigation'
import { getAltaById } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { ArrowLeft, Phone, User, BadgeDollarSign } from 'lucide-react'
import { ChecklistProgress } from '@/components/prepagas/ChecklistProgress'
import { ChecklistInteractivo } from './ChecklistInteractivo'
import { CambiarEstadoAlta } from './CambiarEstadoAlta'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Alta ${id.slice(0, 8)} | Nexo Asesores` }
}

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  en_proceso:  { label: 'En proceso',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  enviada:     { label: 'Enviada',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  observada:   { label: 'Observada',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  aprobada:    { label: 'Aprobada',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rechazada:   { label: 'Rechazada',   color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default async function AltaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const alta = await getAltaById(id)
  if (!alta) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  const { data: comision } = await supabase
    .from('comisiones')
    .select('monto_comision, estado')
    .eq('alta_id', id)
    .maybeSingle()

  const items = (alta.alta_items ?? []) as {
    id: string
    etiqueta: string
    tipo_dato: string
    requerido: boolean
    completado: boolean
    valor_texto: string | null
    valor_fecha: string | null
    valor_numero: number | null
    archivo_path: string | null
  }[]

  const requeridos = items.filter(i => i.requerido).length
  const completados = items.filter(i => i.requerido && i.completado).length

  const lead = alta.leads as {
    first_name: string
    last_name: string | null
    phone: string | null
    cuil: string | null
    edades: string | null
    cantidad_integrantes: number | null
  } | null

  const prepaga = alta.prepagas as { nombre: string; slug: string } | null
  const plan = alta.prepaga_planes as { nombre: string } | null
  const badge = ESTADO_BADGE[alta.estado] ?? ESTADO_BADGE.en_proceso

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/altas"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a altas
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {prepaga?.nombre}
              {plan && <span className="text-slate-400 font-normal ml-2">· {plan.nombre}</span>}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Alta #{id.slice(0, 8)} · {format(new Date(alta.created_at), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Datos del prospecto */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" />
          Prospecto
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Nombre</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {lead?.first_name} {lead?.last_name}
            </p>
          </div>
          {lead?.phone && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Teléfono</p>
              <a href={`tel:${lead.phone}`} className="font-semibold text-blue-600 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {lead.phone}
              </a>
            </div>
          )}
          {lead?.cuil && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">CUIL</p>
              <p className="font-mono text-slate-800 dark:text-slate-200">{lead.cuil}</p>
            </div>
          )}
          {lead?.edades && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Edades / integrantes</p>
              <p className="text-slate-800 dark:text-slate-200">
                {lead.edades}
                {lead.cantidad_integrantes && ` (${lead.cantidad_integrantes})`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Progreso */}
      {requeridos > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Progreso del alta</h2>
          <ChecklistProgress
            totalRequeridos={requeridos}
            completados={completados}
            totalItems={items.length}
            showDetail
          />
        </section>
      )}

      {/* Comisión generada (solo si la alta ya fue aprobada) */}
      {comision && (
        <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 p-5 flex items-center gap-3">
          <BadgeDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              Comisión {comision.estado === 'liquidada' ? 'liquidada' : 'generada'}: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(comision.monto_comision)}
            </p>
          </div>
        </section>
      )}

      {/* Checklist interactivo */}
      <ChecklistInteractivo altaId={alta.id} items={items} />

      {/* Cambiar estado */}
      <CambiarEstadoAlta altaId={alta.id} estadoActual={alta.estado as 'en_proceso' | 'enviada' | 'observada' | 'aprobada' | 'rechazada'} observaciones={alta.observaciones} isAdmin={esAdmin} />
    </div>
  )
}
