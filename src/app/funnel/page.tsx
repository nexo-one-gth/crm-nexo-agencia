import { getAllLeads } from '@/app/actions/lead-actions'
import { LeadFunnelBoard } from '@/components/leads/LeadFunnelBoard'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function FunnelPage({
    searchParams,
}: {
    searchParams: Promise<{ stage?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const params = await searchParams

    let isAdmin = false
    let userProfile = null

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', user.id)
            .single()

        isAdmin = profile?.role === 'admin' || profile?.role === 'admin_principal'
        userProfile = profile ? {
            full_name: `${profile.first_name} ${profile.last_name}`,
            whatsapp_name: profile.first_name
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
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading">
                        {isAdmin
                            ? 'Panel de Control'
                            : `Hola, ${userProfile?.whatsapp_name ?? 'bienvenido'} 👋`}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                        {isAdmin
                            ? 'Gestiona la asignación y progreso de prospectos'
                            : 'Visualiza y gestiona tus prospectos'}
                    </p>
                </div>
            </div>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <LeadFunnelBoard
                initialLeads={leads as any}
                isAdmin={isAdmin}
                userProfile={userProfile}
                initialStage={params.stage}
            />
        </div>
    )
}
