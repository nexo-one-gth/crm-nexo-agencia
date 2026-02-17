'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAdvisorLeads() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('leads')
        .select(`
      *,
      pipeline_stages!inner(id, name)
    `)
        .eq('assigned_to', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching leads:', error)
        return []
    }

    return data.map((lead: any) => ({
        ...lead,
        stage_name: lead.pipeline_stages.name
    }))
}

export async function updateLeadStage(leadId: string, stageName: string, discardReason?: string) {
    const supabase = await createClient()

    // Get stage ID by name
    const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('name', stageName)
        .single()

    if (!stage) return { success: false, error: 'Etapa no encontrada' }

    const updateData: Record<string, unknown> = { stage_id: stage.id }
    if (discardReason) {
        updateData.discard_reason = discardReason
    }

    const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)

    if (error) {
        console.error('Error updating stage:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/funnel')
    revalidatePath('/')
    return { success: true }
}

export async function logWhatsAppActivity(leadId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    // 1. Log activity
    const { error: logError } = await supabase
        .from('activities')
        .insert({
            lead_id: leadId,
            user_id: user.id,
            type: 'whatsapp_sent',
            content: 'Mensaje de WhatsApp enviado al prospecto'
        })

    if (logError) console.error('Error logging WhatsApp activity:', logError)

    // 2. Automatically move to 'Contactado' stage
    return updateLeadStage(leadId, 'Contactado')
}

export async function createLead(values: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    // Get default stage ID (Pendiente)
    const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('name', 'Pendiente')
        .single()

    if (!stage) return { success: false, error: 'Etapa inicial no encontrada' }

    const { data, error } = await supabase
        .from('leads')
        .insert({
            first_name: values.first_name,
            last_name: values.last_name,
            phone: values.phone,
            dni: values.dni,
            cuil: values.cuil,
            obra_social: values.os,
            notes: values.notes,
            stage_id: stage.id,
            assigned_to: user.id, // Auto-assign to the advisor
            source: values.source || 'App Asesores'
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating lead:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/funnel')
    revalidatePath('/')
    return { success: true, data }
}

export async function getPipelineStages() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order', { ascending: true })

    if (error) {
        console.error('Error fetching stages:', error)
        return []
    }

    return data
}

export async function getAllLeads() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get user profile to check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const query = supabase
        .from('leads')
        .select(`
            *,
            pipeline_stages!inner(id, name),
            assigned_to_profile:profiles(first_name, last_name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    // If not admin, only show assigned leads
    if (profile?.role !== 'admin') {
        query.eq('assigned_to', user.id)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching leads:', error)
        return []
    }

    return data.map((lead: any) => ({
        ...lead,
        stage_name: lead.pipeline_stages.name,
        assigned_to_name: lead.assigned_to_profile ? `${lead.assigned_to_profile.first_name} ${lead.assigned_to_profile.last_name}` : 'No asignado'
    }))
}

export async function assignLeadsToAdvisor(leadIds: string[], advisorId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    // Get "Pendiente" stage ID
    const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('name', 'Pendiente')
        .single()

    if (!stage) return { success: false, error: 'Etapa "Pendiente" no encontrada' }

    // Get advisor's active campaign
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('advisor_id', advisorId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    const { error } = await supabase
        .from('leads')
        .update({
            assigned_to: advisorId,
            stage_id: stage.id,
            campaign_id: campaign?.id || null
        })
        .in('id', leadIds)

    if (error) {
        console.error('Error assigning leads:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/funnel')
    return { success: true }
}

export async function addLeadComment(leadId: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase
        .from('activities')
        .insert({
            lead_id: leadId,
            user_id: user.id,
            type: 'comment',
            content
        })

    if (error) {
        console.error('Error adding comment:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/funnel')
    return { success: true }
}

export async function getLeadActivities(leadId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching activities:', error)
        return []
    }

    return data
}
