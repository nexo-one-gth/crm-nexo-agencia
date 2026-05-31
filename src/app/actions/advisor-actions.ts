'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/supabase/assert-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const advisorSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
    firstName: z.string().min(2, { message: "Nombre muy corto" }),
    lastName: z.string().min(2, { message: "Apellido muy corto" }),
    role: z.enum(['admin', 'asesor']).default('asesor')
})

export type ActionResponse<T = unknown> = {
    success: boolean
    data?: T
    error?: string
}

export const createAdvisor = async (formData: z.infer<typeof advisorSchema>): Promise<ActionResponse> => {
    // 1. Verificar que el caller sea admin
    const guard = await assertAdmin()
    if (guard.error) return { success: false, error: guard.error }

    // 2. Validar datos con Zod
    const validated = advisorSchema.safeParse(formData)
    if (!validated.success) {
        return {
            success: false,
            error: validated.error.issues.map((issue: z.ZodIssue) => issue.message).join(', ')
        }
    }

    const { email, password, firstName, lastName, role } = validated.data
    const supabaseAdmin = createAdminClient()

    try {
        // 2. Crear usuario en Auth (requiere SERVICE_ROLE_KEY)
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

        revalidatePath('/admin/advisors')
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
