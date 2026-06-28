// Deployment trigger
import { createClient } from '@/lib/supabase/server'
import { Users, Target, MessageCircle, BarChart3, Clock, FileText, ChevronRight, TrendingUp, BadgeDollarSign } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white text-center">Bienvenido a Nexo Asesores</h1>
        <p className="text-slate-600 dark:text-slate-400 text-center">Por favor inicia sesión para continuar</p>
        <Link
          href="/login"
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:scale-105 transition-all shadow-lg"
        >
          Iniciar Sesión
        </Link>
      </div>
    )
  }

  // Paralelizar todas las queries independientes (BUG 2)
  const [
    { data: stageData },
    { data: recentActivities },
    { data: activeCampaigns },
    { count: altasActivas },
    { data: comisionesPendientes },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('pipeline_stages(name), valor_forecast')
      .eq('assigned_to', user.id)
      .is('deleted_at', null),
    supabase
      .from('activities')
      .select(`id, created_at, leads(first_name, last_name)`)
      .eq('created_by', user.id)
      .eq('type', 'whatsapp_sent')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('campaigns')
      .select('*')
      .eq('advisor_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('altas')
      .select('*', { count: 'exact', head: true })
      .eq('asesor_id', user.id)
      .in('estado', ['en_proceso', 'enviada', 'observada']),
    supabase
      .from('comisiones')
      .select('monto_comision')
      .eq('asesor_id', user.id)
      .eq('estado', 'pendiente'),
  ])

  // Derivar totalLeads y stageCounts de una sola query (BUG 3)
  type StageRow = { pipeline_stages: { name: string } | { name: string }[] | null; valor_forecast?: number | null; [key: string]: unknown }
  const totalLeads = stageData?.length ?? 0
  const stageCounts: Record<string, number> = {}
  const FORECAST_STAGES = new Set(['Interesado', 'Cotizado', 'Alta en Proceso'])
  let totalForecast = 0

  stageData?.forEach((lead: StageRow) => {
    let stageName = 'Otro'
    if (lead.pipeline_stages) {
      if (Array.isArray(lead.pipeline_stages)) {
        stageName = lead.pipeline_stages[0]?.name || 'Otro'
      } else {
        stageName = (lead.pipeline_stages as { name: string }).name || 'Otro'
      }
    }
    stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
    if (FORECAST_STAGES.has(stageName) && typeof lead.valor_forecast === 'number') {
      totalForecast += lead.valor_forecast
    }
  })

  // Sumar saldo de todas las campañas activas (MEJORA 2)
  let remainingLeads: number | null = null
  if (activeCampaigns && activeCampaigns.length > 0) {
    const campaignIds = activeCampaigns.map((c: { id: string }) => c.id)
    const { count: deliveredTotal } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
    const totalAllocated = activeCampaigns.reduce((sum: number, c: { total_leads?: number }) => sum + (c.total_leads ?? 0), 0)
    remainingLeads = Math.max(0, totalAllocated - (deliveredTotal ?? 0))
  }

  const forecastFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalForecast)

  const totalComisionesPendientes = (comisionesPendientes ?? []).reduce((sum, c) => sum + Number(c.monto_comision), 0)
  const comisionesFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalComisionesPendientes)

  const stats = [
    { name: 'Mis Leads', value: totalLeads, icon: Users, color: 'from-blue-600 to-blue-400' },
    { name: 'Leads Restantes', value: remainingLeads !== null ? remainingLeads : '—', icon: Target, color: 'from-rose-600 to-rose-400' },
    { name: 'Interesados', value: stageCounts['Interesado'] || 0, icon: Target, color: 'from-purple-600 to-purple-400' },
    { name: 'Pendientes', value: stageCounts['Pendiente'] || 0, icon: Clock, color: 'from-amber-600 to-amber-400' },
    { name: 'Forecast Pipeline', value: totalForecast > 0 ? forecastFormatted : '—', icon: TrendingUp, color: 'from-emerald-600 to-teal-400' },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">Mi Resumen</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Gestiona tus prospectos y ventas</p>
        </div>
        <Link
          href="/funnel"
          className="w-full sm:w-auto text-center px-6 py-2.5 glass-button rounded-xl flex items-center justify-center gap-2 text-slate-900 dark:text-white font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          Ver Mi Embudo
        </Link>
      </div>

      {/* Stats — 2 columnas en mobile, 5 en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="glass-card p-4 sm:p-5 rounded-2xl flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{stat.name}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">{stat.value}</p>
            </div>
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg shrink-0 ml-2`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Altas en proceso — acceso rápido */}
      <Link
        href="/altas"
        className="glass-card p-4 sm:p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-400 shadow-lg shrink-0">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Altas en proceso</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{altasActivas ?? 0}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
      </Link>

      {/* Mis Comisiones — acceso rápido */}
      <Link
        href="/comisiones"
        className="glass-card p-4 sm:p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 shadow-lg shrink-0">
            <BadgeDollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Comisiones pendientes</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{comisionesFormatted}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Embudo Visual */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl space-y-4 sm:space-y-6">
          <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Estado del Embudo
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {[
              { name: 'Pendiente',       gradient: 'from-blue-600 to-blue-400' },
              { name: 'Contactado',      gradient: 'from-green-600 to-green-400' },
              { name: 'Interesado',      gradient: 'from-purple-600 to-purple-400' },
              { name: 'Cotizado',        gradient: 'from-amber-600 to-amber-400' },
              { name: 'Alta en Proceso', gradient: 'from-emerald-600 to-teal-400' },
              { name: 'Ganado',          gradient: 'from-green-600 to-green-400' },
              { name: 'No Interesado',   gradient: 'from-slate-600 to-slate-400' },
            ].map(({ name, gradient }) => {
              const count = stageCounts[name] || 0
              const percentage = (totalLeads || 0) > 0 ? (count / (totalLeads || 1)) * 100 : 0
              return (
                <Link
                  key={name}
                  href={`/funnel?stage=${encodeURIComponent(name)}`}
                  className="block space-y-1.5 sm:space-y-2 group rounded-xl p-2 -m-2 hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {name}
                    </span>
                    <span className="text-slate-500 text-xs sm:text-sm tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl space-y-4 sm:space-y-6">
          <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Últimos Contactos
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {recentActivities && recentActivities.length > 0 ? (
              recentActivities.map((activity) => {
                const leads = activity.leads
                const leadFirst = Array.isArray(leads) ? leads[0]?.first_name : leads?.first_name
                const leadLast = Array.isArray(leads) ? leads[0]?.last_name : leads?.last_name
                return (
                  <div key={activity.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 shrink-0">
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {leadFirst} {leadLast}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(activity.created_at).toLocaleString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short'
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-36 sm:h-48 border-2 border-dashed border-white/10 rounded-2xl opacity-40">
                <p className="text-sm font-medium">Sin actividad reciente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
