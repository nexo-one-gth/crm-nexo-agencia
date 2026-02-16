'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const advisorSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
    firstName: z.string().min(2, { message: "Nombre muy corto" }),
    lastName: z.string().min(2, { message: "Apellido muy corto" }),
    role: z.enum(['admin', 'asesor']).default('asesor')
})

export type ActionResponse<T = any> = {
    success: boolean
    data?: T
    error?: string
}

export const createAdvisor = async (formData: z.infer<typeof advisorSchema>): Promise<ActionResponse> => {
    // 1. Validar datos con Zod
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
            email_confirm: true
        })

        if (authError) {
            return { success: false, error: `Error en Auth: ${authError.message}` }
        }

        if (!authUser.user) {
            return { success: false, error: "No se pudo crear el usuario en Auth." }
        }

        // 3. Crear perfil en la tabla 'profiles'
        const supabase = await createClient()
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authUser.user.id,
                email,
                first_name: firstName,
                last_name: lastName,
                role
            })

        if (profileError) {
            // Rollback manual (opcional, pero útil)
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
            return { success: false, error: `Error en Perfil: ${profileError.message}` }
        }

        revalidatePath('/admin/advisors')
        return { success: true }

    } catch (err: any) {
        return { success: false, error: err.message || "Ocurrió un error inesperado" }
    }
}

export const getAdvisors = async (): Promise<ActionResponse<any[]>> => {
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
