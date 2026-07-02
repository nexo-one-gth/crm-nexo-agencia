'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin, assertAdminPrincipal } from '@/lib/supabase/assert-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const advisorSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
    firstName: z.string().min(2, { message: "Nombre muy corto" }),
    lastName: z.string().min(2, { message: "Apellido muy corto" }),
    role: z.enum(['admin_principal', 'admin', 'asesor']).default('asesor')
})

export type ActionResponse<T = unknown> = {
    success: boolean
    data?: T
    error?: string
}

export const createAdvisor = async (formData: z.infer<typeof advisorSchema>): Promise<ActionResponse> => {
    // 1. Verificar que el caller sea admin o admin_principal
    const guard = await assertAdmin()
    if (guard.error || !guard.user) return { success: false, error: guard.error ?? 'Error de autenticación' }
    const callerId = guard.user.id

    // 2. Validar datos con Zod
    const validated = advisorSchema.safeParse(formData)
    if (!validated.success) {
        return {
            success: false,
            error: validated.error.issues.map((issue: z.ZodIssue) => issue.message).join(', ')
        }
    }

    const { email, password, firstName, lastName, role } = validated.data
    const supabase = await createClient()

    // Obtener rol del caller para validar permisos y lógica de auto-asignación
    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', callerId)
        .single()

    const callerRole = callerProfile?.role

    // Solo admin_principal puede crear admins o admin_principal
    if (role !== 'asesor' && callerRole !== 'admin_principal') {
        return { success: false, error: 'Solo el admin principal puede crear administradores' }
    }

    const supabaseAdmin = createAdminClient()

    try {
        // Crear usuario en Auth (requiere SERVICE_ROLE_KEY)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                role: role
            }
        })

        if (authError) {
            return { success: false, error: `Error en Auth: ${authError.message}` }
        }

        if (!authUser.user) {
            return { success: false, error: "No se pudo crear el usuario en Auth." }
        }

        // NOTA: No insertamos manualmente en 'profiles' porque el trigger 'on_auth_user_created'
        // definido en la base de datos se encarga de hacerlo automáticamente usando la 'user_metadata'.

        // Si un admin regular crea un asesor, lo auto-asigna a su grupo
        if (role === 'asesor' && callerRole === 'admin') {
            await supabase
                .from('admin_asesores')
                .insert({ admin_id: callerId, asesor_id: authUser.user.id })
        }

        revalidatePath('/admin/advisors')
        revalidatePath('/settings')
        return { success: true }

    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Ocurrió un error inesperado" }
    }
}

export const getAdvisors = async (): Promise<ActionResponse<Record<string, unknown>[]>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data }
}

// Retorna asesores + admins con aparecer_en_tablero activo (para asignación de leads)
export const getAsesoresParaAsignar = async (): Promise<ActionResponse<Record<string, unknown>[]>> => {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, aparecer_en_tablero')
        .or('role.eq.asesor,and(role.eq.admin,aparecer_en_tablero.eq.true)')
        .order('first_name', { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data ?? [] }
}

export const toggleAparecer = async (advisorId: string, value: boolean): Promise<ActionResponse> => {
    const guard = await assertAdmin()
    if (guard.error) return { success: false, error: guard.error }

    const supabase = await createClient()
    const { error } = await supabase
        .from('profiles')
        .update({ aparecer_en_tablero: value })
        .eq('id', advisorId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
}

export const getPrepagasDeAsesor = async (asesorId: string) => {
    const guard = await assertAdmin()
    if (guard.error) return []

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('prepaga_asesores_safe')
        .select('*, prepagas(id, nombre, slug)')
        .eq('asesor_id', asesorId)
        .eq('activo', true)

    if (error) { console.error('getPrepagasDeAsesor:', error); return [] }
    return data ?? []
}

export const getAllPrepagasParaAsignar = async () => {
    const guard = await assertAdmin()
    if (guard.error) return []

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('prepagas')
        .select('id, nombre, slug')
        .order('orden', { ascending: true })

    if (error) return []
    return data ?? []
}

type ProfileData = {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    role: string
    aparecer_en_tablero: boolean
    codigo_productor: string | null
}

export type AdminConAsesoresData = {
    admins: ProfileData[]
    asesores: ProfileData[]
    assignments: { admin_id: string; asesor_id: string }[]
}

export const getAdminsConAsesores = async (): Promise<ActionResponse<AdminConAsesoresData>> => {
    const guard = await assertAdmin()
    if (guard.error || !guard.user) return { success: false, error: guard.error ?? 'Error de autenticación' }
    const callerId = guard.user.id

    const supabase = await createClient()

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', callerId)
        .single()

    const isAdminPrincipal = callerProfile?.role === 'admin_principal'

    if (isAdminPrincipal) {
        // Admin principal: ve todos los admins, asesores y asignaciones
        const [adminsRes, asesoresRes, assignmentsRes] = await Promise.all([
            supabase.from('profiles').select('id, first_name, last_name, email, role, aparecer_en_tablero, codigo_productor').in('role', ['admin', 'admin_principal']).order('first_name', { ascending: true }),
            supabase.from('profiles').select('id, first_name, last_name, email, role, aparecer_en_tablero, codigo_productor').eq('role', 'asesor').order('first_name', { ascending: true }),
            supabase.from('admin_asesores').select('admin_id, asesor_id')
        ])
        if (adminsRes.error || asesoresRes.error) return { success: false, error: 'Error al cargar datos' }
        return {
            success: true,
            data: {
                admins: (adminsRes.data ?? []) as ProfileData[],
                asesores: (asesoresRes.data ?? []) as ProfileData[],
                assignments: assignmentsRes.data ?? []
            }
        }
    } else {
        // Admin regular: solo ve su propio grupo de asesores
        const assignmentsRes = await supabase
            .from('admin_asesores')
            .select('admin_id, asesor_id')
            .eq('admin_id', callerId)

        const myAsesorIds = (assignmentsRes.data ?? []).map(a => a.asesor_id)

        let asesoresData: ProfileData[] = []
        if (myAsesorIds.length > 0) {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, role, aparecer_en_tablero, codigo_productor')
                .in('id', myAsesorIds)
                .order('first_name', { ascending: true })
            asesoresData = (data ?? []) as ProfileData[]
        }

        return {
            success: true,
            data: {
                admins: [],
                asesores: asesoresData,
                assignments: assignmentsRes.data ?? []
            }
        }
    }
}

export type LeadsAsignadosStat = {
    asesor_id: string
    nombre: string
    email: string | null
    count: number
}

export type LeadsAsignadosData = {
    stats: LeadsAsignadosStat[]
    total: number
}

// Cantidad de leads asignados por asesor en un rango de fechas (usa leads.assigned_at)
export const getLeadsAsignadosPorFecha = async (desde: string, hasta: string): Promise<ActionResponse<LeadsAsignadosData>> => {
    const guard = await assertAdmin()
    if (guard.error || !guard.user) return { success: false, error: guard.error ?? 'Error de autenticación' }
    const callerId = guard.user.id

    const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha inválida' })
    const parsed = z.object({ desde: fechaSchema, hasta: fechaSchema }).safeParse({ desde, hasta })
    if (!parsed.success) return { success: false, error: 'Rango de fechas inválido' }

    const supabase = await createClient()

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', callerId)
        .single()

    let query = supabase
        .from('leads')
        .select('assigned_to')
        .not('assigned_to', 'is', null)
        .is('deleted_at', null)
        .gte('assigned_at', `${desde}T00:00:00`)
        .lte('assigned_at', `${hasta}T23:59:59.999`)

    // Admin regular: solo los leads de su equipo (asesores asignados + él mismo)
    if (callerProfile?.role !== 'admin_principal') {
        const { data: adminAsesores } = await supabase
            .from('admin_asesores')
            .select('asesor_id')
            .eq('admin_id', callerId)

        const teamIds = [callerId, ...(adminAsesores ?? []).map(a => a.asesor_id)]
        query = query.in('assigned_to', teamIds)
    }

    const { data: leads, error } = await query
    if (error) return { success: false, error: error.message }

    const countsById = new Map<string, number>()
    for (const lead of leads ?? []) {
        if (!lead.assigned_to) continue
        countsById.set(lead.assigned_to, (countsById.get(lead.assigned_to) ?? 0) + 1)
    }

    let stats: LeadsAsignadosStat[] = []
    if (countsById.size > 0) {
        const { data: perfiles, error: perfilesError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', Array.from(countsById.keys()))

        if (perfilesError) return { success: false, error: perfilesError.message }

        stats = (perfiles ?? []).map(p => ({
            asesor_id: p.id,
            nombre: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email ?? 'Sin nombre'),
            email: p.email,
            count: countsById.get(p.id) ?? 0
        })).sort((a, b) => b.count - a.count)
    }

    const total = stats.reduce((acc, s) => acc + s.count, 0)
    return { success: true, data: { stats, total } }
}

export const asignarAsesorAAdmin = async (adminId: string, asesorId: string): Promise<ActionResponse> => {
    const guard = await assertAdminPrincipal()
    if (guard.error) return { success: false, error: guard.error }

    const supabase = await createClient()
    const { error } = await supabase
        .from('admin_asesores')
        .insert({ admin_id: adminId, asesor_id: asesorId })

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
}

export const desasignarAsesorDeAdmin = async (adminId: string, asesorId: string): Promise<ActionResponse> => {
    const guard = await assertAdminPrincipal()
    if (guard.error) return { success: false, error: guard.error }

    const supabase = await createClient()
    const { error } = await supabase
        .from('admin_asesores')
        .delete()
        .match({ admin_id: adminId, asesor_id: asesorId })

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
}

export const actualizarCodigoProductor = async (profileId: string, codigo: string | null): Promise<ActionResponse> => {
    const guard = await assertAdmin()
    if (guard.error) return { success: false, error: guard.error }

    const supabase = await createClient()
    const { error } = await supabase
        .from('profiles')
        .update({ codigo_productor: codigo })
        .eq('id', profileId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/settings')
    return { success: true }
}
