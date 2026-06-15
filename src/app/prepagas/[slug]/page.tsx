import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getPrepagaBySlug } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { ArrowLeft, FileText, ExternalLink, Plus, Settings2 } from 'lucide-react'
import { IniciarAltaDesdeDetalle } from './IniciarAltaDesdeDetalle'
import { PlanesAdminSection } from './PlanesAdminSection'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `${slug.toUpperCase()} | Prepagas` }
}

export default async function PrepagaDetallePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const prepaga = await getPrepagaBySlug(slug)
  if (!prepaga) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const planesActivos = (prepaga.prepaga_planes ?? []).filter((p: { activo: boolean }) => p.activo)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <Link
          href="/prepagas"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a prepagas
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{prepaga.nombre}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{prepaga.tipo_cotizador}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {prepaga.cotizador_url && (
              <Link
                href={`/prepagas/${prepaga.slug}/cotizar`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
                Cotizar
              </Link>
            )}
            <IniciarAltaDesdeDetalle
              prepagaId={prepaga.id}
              prepagaNombre={prepaga.nombre}
            />
          </div>
        </div>
      </div>

      {/* Planes */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Planes disponibles
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{planesActivos.length} activos</span>
            {isAdmin && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                <Settings2 className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>
        </div>

        {isAdmin ? (
          <PlanesAdminSection
            prepagaId={prepaga.id}
            planesIniciales={planesActivos.map((p: { id: string; nombre: string; descripcion: string | null }) => ({
              id: p.id,
              nombre: p.nombre,
              descripcion: p.descripcion,
            }))}
          />
        ) : planesActivos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sin planes cargados</p>
        ) : (
          <div className="space-y-2">
            {planesActivos.map((plan: { id: string; nombre: string; descripcion: string | null }) => (
              <div
                key={plan.id}
                className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{plan.nombre}</p>
                  {plan.descripcion && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{plan.descripcion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documentación requerida */}
      {(prepaga.checklist_plantillas ?? []).length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5">
          <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-emerald-500" />
            Documentación requerida (alta estándar)
          </h2>
          {prepaga.checklist_plantillas
            .filter((pt: { tipo_alta: string | null; activa: boolean }) => pt.tipo_alta === null && pt.activa)
            .slice(0, 1)
            .map((plantilla: {
              id: string
              nombre: string
              checklist_plantilla_items: { id: string; etiqueta: string; requerido: boolean; tipo_dato: string; orden: number }[]
            }) => (
              <div key={plantilla.id} className="space-y-2">
                {plantilla.checklist_plantilla_items
                  .sort((a, b) => a.orden - b.orden)
                  .map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.requerido ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      <span className={item.requerido ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}>
                        {item.etiqueta}
                        {!item.requerido && <span className="ml-1 text-xs opacity-60">(opcional)</span>}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
        </section>
      )}
    </div>
  )
}
