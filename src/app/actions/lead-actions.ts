'use server'

import { createClient } from '@/lib/supabase/server'
import { assertAdmin, assertSupervisorOrAdmin, isAdminRole, isSupervisorRole } from '@/lib/supabase/assert-admin'
import { z } from 'zod'
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
        // Si sos supervisor y además vendés, `assigned_to = vos` mezcla tu
        // cartera real con cualquier lote que te hayan pasado solo para que
        // lo repartas (`pendiente_reparto=true`). Ese lote se ve en /equipo,
        // no en tu embudo propio.
        .eq('pendiente_reparto', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching leads:', error)
        return []
    }

    return data.map((lead: { pipeline_stages: { name: string }, [key: string]: unknown }) => ({
        ...lead,
        stage_name: lead.pipeline_stages.name
    }))
}

export async function updateLeadStage(leadId: string, stageName: string, discardReason?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    // Get stage ID by name
    const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('name', stageName)
        .single()

    if (!stage) return { success: false, error: 'Etapa no encontrada' }

    // Etapa actual del lead, para poder registrar el cambio en el historial
    const { data: currentLead } = await supabase
        .from('leads')
        .select('pipeline_stages!inner(name)')
        .eq('id', leadId)
        .single() as { data: { pipeline_stages: { name: string } } | null }
    const previousStageName = currentLead?.pipeline_stages?.name

    const updateData: Record<string, unknown> = { pipeline_stage_id: stage.id }
    if (discardReason) {
        updateData.discard_reason = discardReason
    }

    // Sin filtro por rol: el alcance lo resuelve el RLS de `leads`. El filtro
    // de acá no conocía a los líderes, así que un supervisor no podía mover en
    // el embudo los leads de su propio equipo.
    //
    // El .select() no es decorativo: cuando el RLS bloquea un UPDATE, Postgres
    // no devuelve error, simplemente afecta 0 filas. Sin este chequeo la acción
    // reportaría éxito y el lead no se habría movido.
    const { data: actualizados, error } = await supabase
        .from('leads').update(updateData).eq('id', leadId).select('id')

    if (error) {
        console.error('Error updating stage:', error)
        return { success: false, error: error.message }
    }
    if (!actualizados || actualizados.length === 0) {
        return { success: false, error: 'No tenés permiso para mover este lead' }
    }

    if (previousStageName && previousStageName !== stageName) {
        const description = discardReason
            ? `${previousStageName} → ${stageName} (motivo: ${discardReason})`
            : `${previousStageName} → ${stageName}`
        const { error: logError } = await supabase
            .from('activities')
            .insert({
                lead_id: leadId,
                created_by: user.id,
                type: 'stage_change',
                description
            })
        if (logError) console.error('Error logging stage_change activity:', logError)
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
            created_by: user.id,
            type: 'whatsapp_sent',
            description: 'Mensaje de WhatsApp enviado al prospecto'
        })

    if (logError) console.error('Error logging WhatsApp activity:', logError)

    // 2. Automatically move to 'Contactado' stage
    return updateLeadStage(leadId, 'Contactado')
}

export async function createLead(values: { first_name: string; last_name: string; phone: string; dni?: string; cuil?: string; os?: string; notes?: string; source?: string }) {
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
            pipeline_stage_id: stage.id,
            assigned_to: user.id, // Auto-assign to the advisor
            // Quién trajo el dato. Antes solo quedaba en el historial de
            // actividades; tenerlo en el lead permite responder "¿este dato lo
            // trajo un asesor o vino de Nexo?" sin reconstruir el timeline, que
            // es justamente lo que distingue la escala comisional.
            created_by: user.id,
            source: values.source || 'App Asesores',
            // Cargado a mano por un usuario del CRM → referido. Los de Nexo
            // entran por importación y nacen con origen 'nexo' o 'campania'.
            origen: 'referido'
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating lead:', error)
        return { success: false, error: error.message }
    }

    const { error: logError } = await supabase
        .from('activities')
        .insert({
            lead_id: data.id,
            created_by: user.id,
            type: 'lead_created',
            description: `Lead ingresado vía ${values.source || 'App Asesores'}`
        })
    if (logError) console.error('Error logging lead_created activity:', logError)

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

    let query = supabase
        .from('leads')
        .select(`
            *,
            pipeline_stages!inner(id, name),
            assigned_to_profile:profiles!left(first_name, last_name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (profile?.role === 'admin_principal') {
        // admin_principal ve todos los leads sin filtro adicional
    } else if (isAdminRole(profile?.role) || isSupervisorRole(profile?.role)) {
        // Quien conduce un equipo ve: los leads de su equipo, LOS PROPIOS, y el
        // pool sin asignar.
        //
        // Las ramas de admin y supervisor estaban duplicadas y solo la de
        // supervisor incluía `assigned_to = uno mismo`. Por eso Carolina —admin
        // con 4 asesores y 153 leads propios— no veía su propia cartera en el
        // embudo: veía la de su equipo y nada más. Unificadas para que no
        // vuelvan a divergir.
        const { data: equipo } = await supabase
            .from('admin_asesores')
            .select('asesor_id')
            .eq('admin_id', user.id)

        // El `and(...)` sobre la propia fila excluye los leads que solo están
        // de paso para reparto (`pendiente_reparto=true`): esos son del pool
        // a repartir en /equipo, no cartera propia para ver en el embudo. Los
        // leads del equipo y el pool sin asignar no llevan esa restricción —
        // el filtro es sobre la fila del propio caller, no sobre las demás.
        const asesorIds = (equipo ?? []).map(a => a.asesor_id)
        if (asesorIds.length > 0) {
            const idList = asesorIds.join(',')
            query = query.or(`assigned_to.in.(${idList}),and(assigned_to.eq.${user.id},pendiente_reparto.eq.false),assigned_to.is.null`)
        } else if (isSupervisorRole(profile?.role)) {
            query = query.or(`and(assigned_to.eq.${user.id},pendiente_reparto.eq.false),assigned_to.is.null`)
        }
        // Un admin sin equipo asignado sigue viendo todo (comportamiento previo).
    } else {
        query = query.eq('assigned_to', user.id)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching leads:', error)
        return []
    }

    return data.map((lead: { pipeline_stages: { name: string }, assigned_to_profile: { first_name: string | null, last_name: string | null } | null, [key: string]: unknown }) => ({
        ...lead,
        stage_name: lead.pipeline_stages.name,
        assigned_to_name: lead.assigned_to_profile ? `${lead.assigned_to_profile.first_name ?? ''} ${lead.assigned_to_profile.last_name ?? ''}`.trim() : 'No asignado'
    }))
}

export async function getLeadById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('leads')
        .select(`
            *,
            pipeline_stages!inner(id, name),
            assigned_to_profile:profiles(first_name, last_name)
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (error) {
        console.error('Error fetching lead by ID:', error)
        return null
    }

    return {
        ...data,
        stage_name: data.pipeline_stages.name,
        assigned_to_name: data.assigned_to_profile ? `${data.assigned_to_profile.first_name} ${data.assigned_to_profile.last_name}` : 'No asignado'
    }
}

export async function assignLeadsToAdvisor(leadIds: string[], advisorId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const guard = await assertSupervisorOrAdmin()
    if (guard.error) return { success: false, error: guard.error }

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

    // Cadena de derivación: admin/admin_principal → supervisor → asesor (o el
    // propio supervisor). Un lote que un admin le pasa a alguien que conduce
    // un equipo queda "pendiente de asignación" en su buzón — es el supervisor
    // quien decide si lo trabaja él o lo reparte. Cualquier otro salto de la
    // cadena (un supervisor repartiendo dentro de su propio equipo, o
    // asignándoselo a sí mismo; un admin asignando a un asesor sin equipo)
    // aterriza directo, como siempre.
    //
    // Las tres condiciones a la vez, ninguna sobra:
    // - quien asigna es admin/admin_principal: es el único nivel que "empieza"
    //   la cadena, un supervisor repartiendo siempre resuelve, nunca reenvía.
    // - el destino no es quien asigna: una autoasignación siempre es "me lo
    //   quedo", nunca "quede pendiente para mí mismo".
    // - el destino conduce un equipo: si no tiene equipo, no hay nadie a quien
    //   repartírselo después, así que no tiene sentido dejarlo pendiente.
    const { data: perfilCaller } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
    const asignaAdminAOtro = isAdminRole(perfilCaller?.role) && advisorId !== user.id
    let quedaPendiente = false
    if (asignaAdminAOtro) {
        const { data: equipoDestino } = await supabase
            .from('admin_asesores').select('asesor_id').eq('admin_id', advisorId).limit(1)
        quedaPendiente = (equipoDestino?.length ?? 0) > 0
    }

    const { error } = await supabase
        .from('leads')
        .update({
            assigned_to: advisorId,
            pipeline_stage_id: stage.id,
            // En cuanto un lead aterriza en un asesor puntual (incluido el
            // propio supervisor, si se lo queda para trabajar), deja de estar
            // "pendiente de reparto" salvo que este mismo movimiento sea el
            // que recién lo puso en tránsito (ver `quedaPendiente` arriba).
            // Sin este reseteo, un lead que alguna vez pasó por
            // `pendiente_reparto=true` podría volver a aparecer como
            // repartible en /equipo aunque ya esté asignado y en trabajo.
            pendiente_reparto: quedaPendiente,
        })
        .in('id', leadIds)

    if (error) {
        console.error('Error assigning leads:', error)
        return { success: false, error: error.message }
    }

    // Si el asesor tiene campaña activa, los leads que aún no pertenecen a ninguna
    // campaña pasan a ella y su origen (que define la escala comisional) es "campania".
    // No se pisa la campaña/origen de leads que ya venían de otra campaña.
    if (campaign?.id) {
        const { error: campaignError } = await supabase
            .from('leads')
            .update({ campaign_id: campaign.id, origen: 'campania' })
            .in('id', leadIds)
            .is('campaign_id', null)
        if (campaignError) console.error('Error attaching campaign to leads:', campaignError)
    }

    revalidatePath('/funnel')
    return { success: true }
}

export async function addLeadComment(leadId: string, content: string) {
    if (!content?.trim()) return { success: false, error: 'El comentario no puede estar vacío' }
    if (content.length > 2000) return { success: false, error: 'El comentario no puede superar los 2000 caracteres' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { error } = await supabase
        .from('activities')
        .insert({
            lead_id: leadId,
            created_by: user.id,
            type: 'comment',
            description: content.trim()
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

// Update lead with validation
export async function updateLead(data: Record<string, unknown>) {
    const leadUpdateSchema = z.object({
        id: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        dni: z.string().optional(),
        address_state: z.string().optional(),
        address_city: z.string().optional(),
        obra_social: z.string().optional(),
        cantidad_integrantes: z.number().int().optional(),
        edades: z.string().optional(),
        cuil: z.string().optional(),
        cuit_empleador: z.string().optional(),
        plan: z.string().optional(),
        prepaga_id: z.string().uuid().optional().nullable(),
        valor_plan: z.number().optional(),
        iva: z.number().optional(),
        descuento_aportes: z.number().optional(),
        descuento_comercial: z.number().optional(),
        valor_final_socio: z.number().optional(),
        valor_forecast: z.number().optional(),
        observaciones_cotizacion: z.string().optional(),
        interest_level: z.number().int().optional(),
        source: z.string().optional(),
        // `origen` NO se acepta acá a propósito: queda definido por la vía de
        // ingreso del lead (importación → 'nexo'/'campania', carga manual del
        // asesor → 'referido', asignación a campaña → 'campania') y define la
        // escala comisional. Editarlo a mano cambiaría la comisión, así que el
        // schema lo descarta: zod strippea las claves que no declara.
        notes: z.string().optional(),
        assigned_to_name: z.string().optional(),
        stage_name: z.string().optional(),
        discard_reason: z.string().optional(),
        numero_tramite: z.string().optional(),
        documentacion_pendiente: z.string().optional(),
        sueldo_bruto: z.number().optional()
    });

    const parseResult = leadUpdateSchema.safeParse(data);
    if (!parseResult.success) {
        return { success: false, error: 'Invalid lead data' };
    }
    const { id, ...updateFields } = parseResult.data;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No autenticado' };

    // Sin filtro por rol: lo resuelve el RLS de `leads` (ver updateLeadStage).
    const { data: actualizados, error } = await supabase
        .from('leads').update(updateFields).eq('id', id).select('id');

    if (!error && (!actualizados || actualizados.length === 0)) {
        return { success: false, error: 'No tenés permiso para editar este lead' };
    }
    if (error) {
        console.error('Error updating lead:', error);
        return { success: false, error: error.message };
    }
    // Revalidate relevant pages
    revalidatePath('/funnel');
    revalidatePath('/');
    return { success: true };
}

export async function deleteLeads(leadIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const guard = await assertAdmin()
    if (guard.error) return { success: false, error: guard.error }

    const { error } = await supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', leadIds)

    if (error) {
        console.error('Error deleting leads:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/funnel')
    revalidatePath('/')
    return { success: true }
}

export async function logCotizadorAbierto(leadId: string, prepagaNombre: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('activities').insert({
        lead_id: leadId,
        created_by: user.id,
        type: 'cotizador_abierto',
        description: `Cotizador ${prepagaNombre} abierto`,
    })
}
