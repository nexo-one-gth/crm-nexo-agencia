import { getAllLeads } from '@/app/actions/lead-actions'
import { LeadFunnelBoard } from '@/components/leads/LeadFunnelBoard'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function FunnelPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let isAdmin = false
    let userProfile = null

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', user.id)
            .single()

        isAdmin = profile?.role === 'admin'
        userProfile = profile ? {
            full_name: `${profile.first_name} ${profile.last_name}`,
            whatsapp_name: profile.first_name // or whatever fallback makes sense
        } : null
    }

    const leads = await getAllLeads()

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Link
                    href="/"
                    className="p-2 rounded-xl glass-button text-slate-600 dark:text-slate-400"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {isAdmin ? 'Panel de Control' : 'Mi Embudo'}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        {isAdmin
                            ? 'Gestiona la asignación y progreso de prospectos'
                            : 'Visualiza y gestiona tus prospectos'}
                    </p>
                </div>
            </div>

            <LeadFunnelBoard initialLeads={leads} isAdmin={isAdmin} userProfile={userProfile} />
        </div>
    )
}
