import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminAdvisorView } from '@/components/admin/AdminAdvisorView'
import { ProfileCard } from '@/components/settings/ProfileCard'
import { Settings as SettingsIcon } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role?.toLowerCase() === 'admin'
    const fullName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        : null

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <BackButton />
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <SettingsIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Administra tu perfil y preferencias</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Mi Perfil — visible para todos */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mi Perfil</h2>
                    </div>
                    <ProfileCard fullName={fullName || null} email={user.email || null} />
                </section>

                {/* Gestión de usuarios — solo admin */}
                {isAdmin && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h2>
                        </div>
                        <AdminAdvisorView />
                    </section>
                )}
            </div>
        </div>
    )
}
