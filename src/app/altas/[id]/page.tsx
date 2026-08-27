import { createClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/supabase/assert-admin'
import { redirect, notFound } from 'next/navigation'
import { getAltaById, getIntegrantes, getFaltantesAlta } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { ArrowLeft, Phone, User, BadgeDollarSign, Package, Download } from 'lucide-react'
import { ChecklistProgress } from '@/components/prepagas/ChecklistProgress'
import { ChecklistInteractivo } from './ChecklistInteractivo'
import { CambiarEstadoAlta } from './CambiarEstadoAlta'
import { CarpetaDriveBanner } from './CarpetaDriveBanner'
import { DatosComerciales } from './DatosComerciales'
import { DatosEspecificos } from './DatosEspecificos'
import { IntegrantesEditor, type Integrante } from './IntegrantesEditor'
import { ResumenTramite } from './ResumenTramite'
import { DocumentacionPosterior } from './DocumentacionPosterior'
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

  const integrantes = (await getIntegrantes(id)) as unknown as Integrante[]

  // Qué le falta al trámite para poder enviarse. Solo tiene sentido calcularlo
  // mientras el alta todavía se puede enviar.
  const faltantes =
    alta.estado === 'en_proceso' || alta.estado === 'observada'
      ? await getFaltantesAlta(id)
      : []

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const esAdmin = isAdminRole(profile?.role)

  const { data: comision } = await supabase
    .from('comisiones')
    .select('monto_comision, estado')
    .eq('alta_id', id)
    .maybeSingle()

  const allItems = (alta.alta_items ?? []) as {
    id: string
    etiqueta: string
    tipo_dato: string
    requerido: boolean
    completado: boolean
    valor_texto: string | null
    valor_fecha: string | null
    valor_numero: number | null
    archivo_path: string | null
    drive_file_url: string | null
    seccion?: string
    momento?: string
  }[]

  // Dos cortes distintos sobre el mismo checklist:
  //   `seccion` = qué tipo de cosa es (documento vs dato de la prepaga)
  //   `momento` = cuándo vence (al enviar vs después de que el admin apruebe)
  const itemsEnvio = allItems.filter(i => (i.momento ?? 'envio') === 'envio')
  const itemsPosteriores = allItems.filter(i => i.momento === 'post_aprobacion')

  const itemsDatos = itemsEnvio.filter(i => i.seccion === 'datos')
  const items = itemsEnvio.filter(i => i.seccion !== 'datos')

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

      {/* Carpeta de Drive del trámite. Solo admin: los asesores no son miembros
          de la unidad compartida de altas, así que el link les daría un 403. */}
      {esAdmin && (
        <CarpetaDriveBanner altaId={alta.id} driveFolderUrl={alta.drive_folder_url ?? null} />
      )}

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

      {/* Datos comerciales del trámite */}
      <DatosComerciales
        altaId={alta.id}
        datos={{
          plan_codigo: alta.plan_codigo ?? null,
          tipo_alta: alta.tipo_alta ?? null,
          cantidad_capitas: alta.cantidad_capitas ?? null,
          cuota: alta.cuota ?? null,
          aportes_promedio: alta.aportes_promedio ?? null,
          sueldo_bruto: alta.sueldo_bruto ?? null,
          periodo_aportes: alta.periodo_aportes ?? null,
          medio_pago: alta.medio_pago ?? null,
        }}
      />

      {/* Datos específicos de la prepaga (configurados en admin/prepagas) */}
      <DatosEspecificos
        altaId={alta.id}
        prepagaNombre={prepaga?.nombre ?? ''}
        items={itemsDatos}
      />

      {/* Integrantes */}
      <IntegrantesEditor altaId={alta.id} integrantes={integrantes} />

      {/* Checklist interactivo (documentos del envío) */}
      <ChecklistInteractivo altaId={alta.id} items={items} isAdmin={esAdmin} />


      {/* Resumen del trámite */}
      <ResumenTramite
        altaId={alta.id}
        resumenInicial={alta.resumen_texto ?? null}
        driveUrlInicial={alta.resumen_drive_url ?? null}
      />

      {/* Paquete para mandarle a la prepaga. Solo admin: es la documentación
          completa del socio en un archivo. */}
      {esAdmin && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Paquete para la prepaga
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Un ZIP con la documentación cargada y el resumen del trámite, para adjuntar al mail o al WhatsApp.
          </p>
          <a
            href={`/api/altas/${alta.id}/paquete`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar paquete
          </a>
        </section>
      )}

      {/* Cambiar estado */}
      <CambiarEstadoAlta altaId={alta.id} estadoActual={alta.estado as 'en_proceso' | 'enviada' | 'observada' | 'aprobada' | 'rechazada'} observaciones={alta.observaciones} isAdmin={esAdmin} faltantes={faltantes} />

      {/* Documentación posterior a la aprobación + pase a liquidación.
          Va al final: es el último tramo del ciclo, después de que el alta
          cambió de estado. */}
      <DocumentacionPosterior
        altaId={alta.id}
        items={itemsPosteriores}
        estado={alta.estado}
        isAdmin={esAdmin}
        yaLiquidando={Boolean(comision)}
      />
    </div>
  )
}
