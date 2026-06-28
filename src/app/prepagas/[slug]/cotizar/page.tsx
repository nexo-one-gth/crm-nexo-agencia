import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getPrepagaBySlug, getCredencialesCotizador } from '@/app/actions/prepaga-actions'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Copy, Info } from 'lucide-react'
import { CopiarCredencial } from './CopiarCredencial'
import { BotonCotizarSancor } from '@/components/prepagas/BotonCotizarSancor'

export default async function CotizarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const prepaga = await getPrepagaBySlug(slug)
  if (!prepaga) notFound()

  const creds = await getCredencialesCotizador(prepaga.id)

  if (prepaga.tipo_cotizador === 'integrado') {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <ExternalLink className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cotizador integrado</h2>
        <p className="text-slate-500 dark:text-slate-400">
          El cotizador integrado de <strong>{prepaga.nombre}</strong> está en desarrollo. Próximamente disponible.
        </p>
        <Link href={`/prepagas/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Volver al detalle
        </Link>
      </div>
    )
  }

  // Sancor bloquea el embebido por X-Frame-Options — no se puede usar el
  // iframe genérico de abajo. En su lugar, abrimos el login en pestaña nueva;
  // si el asesor tiene instalada la extensión NEXO Autologin Sancor, el
  // ingreso y la navegación hasta el simulador se completan solas.
  if (prepaga.slug === 'sancor-salud') {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <ExternalLink className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cotizador {prepaga.nombre}</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Sancor no permite incrustar su cotizador dentro del CRM. Hacé click para abrirlo en una pestaña nueva.
        </p>
        <div className="flex justify-center">
          <BotonCotizarSancor />
        </div>
        <Link href={`/prepagas/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Volver al detalle
        </Link>
      </div>
    )
  }

  if (!prepaga.cotizador_url) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-slate-500">Sin URL de cotizador configurada para esta prepaga.</p>
        <Link href={`/prepagas/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 mt-4 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between shrink-0">
        <Link
          href={`/prepagas/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {prepaga.nombre}
        </Link>
        <a
          href={prepaga.cotizador_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir en nueva pestaña
        </a>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Panel lateral con credenciales */}
        {creds && (creds.usuario || creds.clave) && (
          <aside className="w-64 shrink-0 space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5" />
                Tus credenciales
              </p>
              {creds.usuario && (
                <CopiarCredencial label="Usuario" valor={creds.usuario} />
              )}
              {creds.clave && (
                <CopiarCredencial label="Clave" valor={creds.clave} ocultarValor />
              )}
            </div>
            <p className="text-xs text-slate-400 px-1">
              Si el sitio no permite autocompletar, copiá las credenciales con el botón.
            </p>
          </aside>
        )}

        {/* Iframe */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <iframe
            src={prepaga.cotizador_url}
            className="w-full h-full min-h-[600px]"
            title={`Cotizador ${prepaga.nombre}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    </div>
  )
}
