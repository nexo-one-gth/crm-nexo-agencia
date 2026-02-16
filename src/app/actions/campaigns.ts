'use server'

import { createClient } from '@/lib/supabase/server'
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

    // Check admin role
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return {
            success: false,
            error: 'Acceso no autorizado. Se requiere perfil administrador.',
        }
    }

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
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    let query = supabase
        .from('campaigns')
        .select(
            `
            *,
            advisor:profiles(id, first_name, last_name, email)
        `
        )
        .order('created_at', { ascending: false })

    if (profile?.role !== 'admin') {
        query = query.eq('advisor_id', user.id)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching campaigns:', error)
        return []
    }

    // Fetch counts of delivered leads for each campaign
    const campaignsWithStats = await Promise.all(
        data.map(async (campaign: any) => {
            const { count, error: countError } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)

            if (countError) console.error('Error counting leads for campaign:', campaign.id, countError)

            return {
                ...campaign,
                delivered_leads: count || 0,
                remaining_leads: Math.max(0, campaign.total_leads - (count || 0)),
            }
        })
    )

    return campaignsWithStats
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
