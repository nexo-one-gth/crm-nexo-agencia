import { createClient } from './server'

type AdminGuardSuccess = { user: { id: string }; error: null }
type AdminGuardFailure = { user: null; error: string }
type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure

export async function assertAdmin(): Promise<AdminGuardResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { user: null, error: 'No autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { user: null, error: 'Acceso denegado: se requiere perfil administrador' }
    }

    return { user, error: null }
}
