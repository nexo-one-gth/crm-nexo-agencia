// Envío de email transaccional por HTTP (Resend). Sin dependencia nueva: la
// API es un POST con JSON, agregar el SDK solo para eso no paga.
//
// Contrato deliberado: esta función NUNCA tira. El email es un canal
// secundario del aviso — si el proveedor está caído o falta la API key, la
// asignación del lead tiene que completarse igual y el aviso in-app queda
// como respaldo.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type EnviarEmailArgs = {
  to: string
  subject: string
  html: string
}

type EnviarEmailResult =
  | { ok: true }
  | { ok: false; motivo: 'sin_configurar' | 'error'; detalle?: string }

export async function enviarEmail({ to, subject, html }: EnviarEmailArgs): Promise<EnviarEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  // Sin configurar no es un error: el CRM funciona con la campanita sola
  // mientras el dominio de envío no esté verificado.
  if (!apiKey || !from) return { ok: false, motivo: 'sin_configurar' }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      // El aviso no vale bloquear la respuesta de la asignación.
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      console.error('[email] Resend respondió', res.status, detalle.slice(0, 300))
      return { ok: false, motivo: 'error', detalle: `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (e) {
    console.error('[email] fallo al enviar', e)
    return { ok: false, motivo: 'error', detalle: e instanceof Error ? e.message : 'desconocido' }
  }
}

// Plantilla mínima, consistente con el look del CRM pero sin depender de CSS
// externo: los clientes de correo ignoran <style> y clases.
export function plantillaAviso({ titulo, cuerpo, ctaTexto, ctaUrl }: {
  titulo: string
  cuerpo: string
  ctaTexto: string
  ctaUrl: string
}): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="padding:24px 24px 8px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;">Nexo Salud &middot; CRM</p>
      <h1 style="margin:0;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(titulo)}</h1>
    </td></tr>
    <tr><td style="padding:8px 24px 20px;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(cuerpo)}</p>
    </td></tr>
    <tr><td style="padding:0 24px 28px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:11px 20px;border-radius:12px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(ctaTexto)}</a>
    </td></tr>
  </table>
  <p style="max-width:520px;margin:14px auto 0;font-size:12px;color:#94a3b8;text-align:center;">Recibís este aviso porque sos usuario del CRM de Nexo Salud.</p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
