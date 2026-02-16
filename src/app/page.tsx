// Deployment trigger
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Users, Target, MessageCircle, BarChart3, Clock } from 'lucide-react'
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

  // Fetch metrics for the advisor
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_to', user.id)
    .is('deleted_at', null)

  const { data: stageData } = await supabase
    .from('leads')
    .select('pipeline_stages(name)')
    .eq('assigned_to', user.id)
    .is('deleted_at', null)

  const stageCounts: Record<string, number> = {}
  stageData?.forEach((lead: any) => {
    const stageName = lead.pipeline_stages?.name || 'Otro'
    stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
  })

  const { data: recentActivities } = await supabase
    .from('activities')
    .select(`
      id,
      created_at,
      leads (
        first_name,
        last_name
      )
    `)
    .eq('user_id', user.id)
    .eq('type', 'whatsapp_sent')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch campaigns to get lead balance
  const { data: { user: authUser } } = await supabase.auth.getUser()
  let remainingLeads = 0
  let totalCampaignLeads = 0
  let deliveredLeads = 0

  if (authUser) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('advisor_id', authUser.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (campaigns && campaigns.length > 0) {
      const campaign = campaigns[0]
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)

      deliveredLeads = count || 0
      totalCampaignLeads = campaign.total_leads
      remainingLeads = Math.max(0, totalCampaignLeads - deliveredLeads)
    }
  }

  const stats = [
    { name: 'Mis Leads', value: totalLeads || 0, icon: Users, color: 'from-blue-600 to-blue-400' },
    { name: 'Leads Restantes', value: remainingLeads, icon: Target, color: 'from-rose-600 to-rose-400' },
    { name: 'Interesados', value: stageCounts['Interesado'] || 0, icon: Target, color: 'from-purple-600 to-purple-400' },
    { name: 'Pendientes', value: stageCounts['Pendiente'] || 0, icon: Clock, color: 'from-amber-600 to-amber-400' },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Mi Resumen</h1>
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

      {/* Stats — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="glass-card p-4 sm:p-6 rounded-2xl flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{stat.name}</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
            </div>
            <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg shrink-0`}>
              <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Embudo Visual */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl space-y-4 sm:space-y-6">
          <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Estado del Embudo
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {['Pendiente', 'Contactado', 'Interesado', 'No Interesado'].map((stage, idx) => {
              const count = stageCounts[stage] || 0
              const percentage = (totalLeads || 0) > 0 ? (count / (totalLeads || 1)) * 100 : 0
              return (
                <div key={stage} className="space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-xs sm:text-sm">{stage}</span>
                    <span className="text-slate-500 text-xs sm:text-sm">{count}</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${idx === 0 ? 'from-blue-600 to-blue-400' : idx === 1 ? 'from-green-600 to-green-400' : idx === 2 ? 'from-purple-600 to-purple-400' : 'from-slate-600 to-slate-400'}`}
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </div>
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
              recentActivities.map((activity: any) => (
                <div key={activity.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 shrink-0">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {activity.leads?.first_name} {activity.leads?.last_name}
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
              ))
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
