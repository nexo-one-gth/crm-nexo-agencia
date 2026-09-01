// Creación de avisos. NO es un archivo 'use server' a propósito: si estas
// funciones vivieran en el módulo de server actions, Next las expondría como
// endpoints y cualquiera con sesión podría fabricar un aviso para otro usuario.
// Acá son helpers de servidor, invocables solo desde otras actions.

import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail, plantillaAviso } from '@/lib/email/enviar'

export type TipoNotificacion = 'lead_asignado' | 'leads_para_repartir'

type CrearNotificacionArgs = {
  destinatarioId: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string
  link: string
  cantidad?: number
  leadId?: string | null
  origenId?: string | null
  /** Texto del botón del email. Si se omite, no se manda email. */
  ctaEmail?: string
}

export function urlApp(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

/**
 * Inserta el aviso in-app y, si hay email configurado, lo despacha también por
 * mail. Nunca tira: el llamador (la asignación de leads) ya modificó datos
 * reales y no puede fallar por un aviso.
 */
export async function crearNotificacion(args: CrearNotificacionArgs): Promise<void> {
  const {
    destinatarioId, tipo, titulo, cuerpo, link,
    cantidad = 1, leadId = null, origenId = null, ctaEmail,
  } = args

  try {
    // service_role: el destinatario no es quien inserta, y la tabla no tiene
    // policy de INSERT justamente para que no exista esa puerta con anon key.
    const admin = createAdminClient()

    const { error } = await admin.from('notificaciones').insert({
      destinatario_id: destinatarioId,
      tipo,
      titulo,
      cuerpo,
      link,
      cantidad,
      lead_id: leadId,
      origen_id: origenId,
    })

    if (error) {
      console.error('[notificaciones] no se pudo insertar el aviso', error)
      return
    }

    if (!ctaEmail) return

    const { data: perfil } = await admin
      .from('profiles')
      .select('email')
      .eq('id', destinatarioId)
      .single()

    if (!perfil?.email) return

    await enviarEmail({
      to: perfil.email,
      subject: titulo,
      html: plantillaAviso({ titulo, cuerpo, ctaTexto: ctaEmail, ctaUrl: urlApp(link) }),
    })
  } catch (e) {
    console.error('[notificaciones] fallo inesperado al notificar', e)
  }
}

/**
 * Aviso de asignación de leads. Un aviso por lote, no uno por lead: el reparto
 * masivo es el caso normal en este CRM y 40 avisos por un solo click son ruido,
 * no información.
 */
export async function notificarLeadsAsignados(args: {
  destinatarioId: string
  cantidad: number
  /** true = el lote cayó en el buzón de /equipo para repartir, no es cartera propia. */
  paraRepartir: boolean
  asignadorId: string
}): Promise<void> {
  const { destinatarioId, cantidad, paraRepartir, asignadorId } = args

  // Autoasignarse no genera aviso: ya sabés lo que hiciste.
  if (destinatarioId === asignadorId) return
  if (cantidad < 1) return

  const plural = cantidad === 1 ? 'lead' : 'leads'

  if (paraRepartir) {
    await crearNotificacion({
      destinatarioId,
      tipo: 'leads_para_repartir',
      titulo: `Te llegaron ${cantidad} ${plural} para repartir`,
      cuerpo: `Están esperando en tu buzón de Mi Equipo. Repartilos entre tus asesores o quedátelos para trabajarlos vos.`,
      link: '/equipo',
      cantidad,
      origenId: asignadorId,
      ctaEmail: 'Ir a Mi Equipo',
    })
    return
  }

  await crearNotificacion({
    destinatarioId,
    tipo: 'lead_asignado',
    titulo: `Te asignaron ${cantidad} ${plural} ${cantidad === 1 ? 'nuevo' : 'nuevos'}`,
    cuerpo: `Ya ${cantidad === 1 ? 'está' : 'están'} en tu embudo, en la etapa Pendiente. Contactalos cuanto antes.`,
    link: '/funnel',
    cantidad,
    origenId: asignadorId,
    ctaEmail: 'Ver mi embudo',
  })
}
