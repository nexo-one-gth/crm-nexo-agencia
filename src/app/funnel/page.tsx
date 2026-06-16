import { getAllLeads } from '@/app/actions/lead-actions'
import { LeadFunnelBoard } from '@/components/leads/LeadFunnelBoard'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export type AdvisorToAdmin = Record<string, { id: string; name: string }>

export default async function FunnelPage({
    searchParams,
}: {
    searchParams: Promise<{ stage?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const params = await searchParams

    let isAdmin = false
    let isAdminPrincipal = false
    let userProfile = null
    let advisorToAdmin: AdvisorToAdmin = {}

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', user.id)
            .single()

        isAdmin = profile?.role === 'admin' || profile?.role === 'admin_principal'
        isAdminPrincipal = profile?.role === 'admin_principal'
        userProfile = profile ? {
            full_name: `${profile.first_name} ${profile.last_name}`,
            whatsapp_name: profile.first_name
        } : null

        // Para admin_principal: construir mapa asesor_id → admin
        if (isAdminPrincipal) {
            const [assignmentsRes, adminsRes] = await Promise.all([
                supabase.from('admin_asesores').select('admin_id, asesor_id'),
                supabase.from('profiles').select('id, first_name, last_name').in('role', ['admin', 'admin_principal'])
            ])

            const adminMap: Record<string, string> = {}
            for (const a of adminsRes.data ?? []) {
                adminMap[a.id] = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim()
            }

            for (const assignment of assignmentsRes.data ?? []) {
                advisorToAdmin[assignment.asesor_id] = {
                    id: assignment.admin_id,
                    name: adminMap[assignment.admin_id] ?? 'Sin Admin'
                }
            }
        }
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
                isAdminPrincipal={isAdminPrincipal}
                advisorToAdmin={advisorToAdmin}
                userProfile={userProfile}
                initialStage={params.stage}
            />
        </div>
    )
}
