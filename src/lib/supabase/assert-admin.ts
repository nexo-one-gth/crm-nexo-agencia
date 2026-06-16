import { createClient } from './server'

type AdminGuardSuccess = { user: { id: string }; error: null }
type AdminGuardFailure = { user: null; error: string }
type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure

const ADMIN_ROLES = ['admin', 'admin_principal'] as const

export function isAdminRole(role: string | null | undefined): boolean {
    return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])
}

export async function assertAdmin(): Promise<AdminGuardResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { user: null, error: 'No autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!isAdminRole(profile?.role)) {
        return { user: null, error: 'Acceso denegado: se requiere perfil administrador' }
    }

    return { user, error: null }
}

export async function assertAdminPrincipal(): Promise<AdminGuardResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { user: null, error: 'No autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin_principal') {
        return { user: null, error: 'Acceso denegado: se requiere perfil admin principal' }
    }

    return { user, error: null }
}
