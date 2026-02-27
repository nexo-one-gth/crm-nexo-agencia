'use server'

import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const LeadImportSchema = z.object({
    NOMBRE: z.preprocess((v) => String(v || '').trim(), z.string().min(1, 'Nombre requerido')),
    DNI: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    PROVINCIA: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    LOCALIDAD: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    CELULAR: z.preprocess((v) => String(v || '').trim(), z.string().min(7, 'Celular requerido')),
    MAIL: z.preprocess((v) => {
        const str = String(v || '').trim();
        return str && str.includes('@') ? str : '';
    }, z.string().optional()),
    // --- Nuevos campos de migración crm-lh ---
    NUMERO_TRAMITE: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    ORIGEN_DATO: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    CANTIDAD_INTEGRANTES: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    EDADES: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    CUIL: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    CUIT_EMPLEADOR: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    OBRA_SOCIAL: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    OBSERVACIONES: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    PLAN: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    VALOR_PLAN: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    DESCUENTO_APORTES: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    DESCUENTO_COMERCIAL: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    IVA: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    VALOR_FINAL_SOCIO: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    VALOR_FORECAST: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? undefined : n;
    }, z.number().optional()),
    OBSERVACIONES_COTIZACION: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    ETAPA: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
    NIVEL_INTERES: z.preprocess((v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
    }, z.number().optional()),
    RAZON_PERDIDA: z.preprocess((v) => String(v || '').trim(), z.string().optional()),
})

type LeadImportData = z.infer<typeof LeadImportSchema>

export async function importLeadsAction(formData: FormData) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'No autenticado' }

        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'No se subió ningún archivo' }

        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(worksheet)

        if (rawData.length === 0) return { success: false, error: 'El archivo está vacío' }

        // Get "Pendiente de Asignación" stage
        const { data: stage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('name', 'Pendiente de Asignación')
            .single()

        if (!stage) return { success: false, error: 'Etapa de asignación no encontrada. Por favor contacte soporte.' }

        const errors: { row: number, error: string }[] = []
        let importedCount = 0

        const normalizedData = rawData.map(row => {
            const normalized: Record<string, unknown> = {};
            Object.keys(row as object).forEach(key => {
                normalized[key.trim().toUpperCase()] = (row as Record<string, unknown>)[key];
            });
            return normalized;
        });

        for (let i = 0; i < normalizedData.length; i++) {
            const row = normalizedData[i];
            let validated: LeadImportData

            try {
                validated = LeadImportSchema.parse(row)
            } catch (err: unknown) {
                console.error(`Error en fila ${i + 2}:`, err);
                let errorMsg = 'Datos inválidos';
                if (err instanceof z.ZodError) {
                    errorMsg = err.issues.map((iss: z.ZodIssue) => `${iss.path.join('.')}: ${iss.message}`).join(', ');
                }
                errors.push({ row: i + 2, error: errorMsg })
                continue
            }

            // Split name if possible (very basic split)
            const nameParts = validated.NOMBRE.split(' ')
            const firstName = nameParts[0]
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '.'

            // Clean phone: remove leading apostrophe from crm-lh export format
            const cleanPhone = validated.CELULAR.replace(/^'/, '')

            const leadData: Record<string, unknown> = {
                first_name: firstName,
                last_name: lastName,
                phone: cleanPhone,
                email: validated.MAIL || null,
                dni: validated.DNI && validated.DNI.trim() !== '' ? validated.DNI.trim() : null,
                address_state: validated.PROVINCIA || null,
                address_city: validated.LOCALIDAD || null,
                stage_id: stage.id,
                assigned_to: null,
                source: validated.ORIGEN_DATO || 'Importación Excel',
                notes: validated.OBSERVACIONES || `Importado de Excel - Ubicación: ${validated.LOCALIDAD || ''}, ${validated.PROVINCIA || ''}`.trim(),
                // Nuevos campos de migración
                numero_tramite: validated.NUMERO_TRAMITE || null,
                cantidad_integrantes: validated.CANTIDAD_INTEGRANTES || null,
                edades: validated.EDADES || null,
                cuil: validated.CUIL || null,
                cuit_empleador: validated.CUIT_EMPLEADOR || null,
                obra_social: validated.OBRA_SOCIAL || null,
                plan: validated.PLAN || null,
                valor_plan: validated.VALOR_PLAN || null,
                descuento_aportes: validated.DESCUENTO_APORTES || null,
                descuento_comercial: validated.DESCUENTO_COMERCIAL || null,
                iva: validated.IVA || null,
                valor_final_socio: validated.VALOR_FINAL_SOCIO || null,
                valor_forecast: validated.VALOR_FORECAST || null,
                observaciones_cotizacion: validated.OBSERVACIONES_COTIZACION || null,
                interest_level: validated.NIVEL_INTERES || 0,
                discard_reason: validated.RAZON_PERDIDA || null,
            }

            // Insertar fila por fila para manejar errores individuales (ej. DNI duplicado)
            const { error: insertError } = await supabase.from('leads').insert(leadData)

            if (insertError) {
                console.error(`Error insertando fila ${i + 2}:`, insertError)
                let errorMsg = 'Error al insertar en la base de datos'
                if (insertError.code === '23505') {
                    if (insertError.message.includes('dni')) {
                        errorMsg = `DNI duplicado: ${validated.DNI}`
                    } else if (insertError.message.includes('phone')) {
                        errorMsg = `Teléfono duplicado: ${validated.CELULAR}`
                    } else {
                        errorMsg = 'Registro duplicado (ya existe en la base de datos)'
                    }
                }
                errors.push({ row: i + 2, error: errorMsg })
            } else {
                importedCount++
            }
        }

        revalidatePath('/funnel')
        return {
            success: true,
            data: {
                imported: importedCount,
                failed: errors.length,
                errors
            }
        }

    } catch (error: unknown) {
        console.error('Import error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
    }
}
