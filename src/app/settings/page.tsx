import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminAdvisorView } from '@/components/admin/AdminAdvisorView'
import { Settings as SettingsIcon, ShieldAlert } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Comprobar si el usuario es administrador
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role?.toLowerCase() === 'admin'

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <BackButton />
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <SettingsIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Administra las preferencias y el equipo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {isAdmin ? (
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h2>
                        </div>
                        <AdminAdvisorView />
                    </section>
                ) : (
                    <div className="glass-card p-12 rounded-3xl border-dashed flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                            <ShieldAlert className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Acceso Restringido</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                            Lo sentimos, esta sección de configuración solo es accesible para administradores del sistema.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
