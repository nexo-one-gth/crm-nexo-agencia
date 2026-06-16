'use server'

import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/supabase/assert-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const campaignSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    description: z.string().optional(),
    advisor_id: z.string().uuid('Seleccione un asesor válido'),
    total_leads: z.number().int().positive('El total de leads debe ser positivo'),
    daily_rhythm: z.number().int().positive('El ritmo diario debe ser positivo'),
})

export async function createCampaign(values: z.infer<typeof campaignSchema>) {
    const supabase = await createClient()

    const guard = await assertAdmin()
    if (guard.error || !guard.user) return { success: false, error: guard.error ?? 'No autenticado' }
    const { user } = guard

    const validated = campaignSchema.safeParse(values)
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0].message }
    }

    const { data, error } = await supabase
        .from('campaigns')
        .insert({
            name: validated.data.name,
            description: validated.data.description,
            advisor_id: validated.data.advisor_id,
            total_leads: validated.data.total_leads,
            daily_rhythm: validated.data.daily_rhythm,
            active: true,
            created_by: user.id,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating campaign:', error)
        return { success: false, error: 'Error al crear la campaña' }
    }

    revalidatePath('/admin/campaigns')
    revalidatePath('/')
    return { success: true, data }
}

export async function getCampaigns() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'admin_principal'

    // Una sola query: campañas + asesor + count de leads por campaña via subquery RPC
    // Usamos execute_sql-style via from() con el count embebido en el select
    let query = supabase
        .from('campaigns')
        .select(`
            *,
            advisor:profiles(id, first_name, last_name, email),
            delivered_leads:leads(count)
        `)
        .order('created_at', { ascending: false })

    if (!isAdmin) {
        query = query.eq('advisor_id', user.id)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching campaigns:', error)
        return []
    }

    return data.map((campaign: { total_leads: number; delivered_leads: { count: number }[]; [key: string]: unknown }) => {
        const delivered = campaign.delivered_leads?.[0]?.count ?? 0
        return {
            ...campaign,
            delivered_leads: delivered,
            remaining_leads: Math.max(0, campaign.total_leads - delivered),
        }
    })
}

export async function getAdvisors() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('role', 'asesor')
        .order('first_name')

    if (error) {
        console.error('Error fetching advisors:', error)
        return []
    }

    return data
}
