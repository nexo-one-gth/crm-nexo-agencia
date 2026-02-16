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

        const validLeads: any[] = []
        const errors: any[] = []

        const normalizedData = rawData.map(row => {
            const normalized: any = {};
            Object.keys(row as object).forEach(key => {
                normalized[key.trim().toUpperCase()] = (row as any)[key];
            });
            return normalized;
        });

        for (let i = 0; i < normalizedData.length; i++) {
            const row = normalizedData[i];
            try {
                const validated = LeadImportSchema.parse(row)

                // Split name if possible (very basic split)
                const nameParts = validated.NOMBRE.split(' ')
                const firstName = nameParts[0]
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '.'

                validLeads.push({
                    first_name: firstName,
                    last_name: lastName, // some DBs require it
                    phone: validated.CELULAR,
                    email: validated.MAIL || null,
                    dni: validated.DNI || null,
                    address_state: validated.PROVINCIA || null,
                    address_city: validated.LOCALIDAD || null,
                    stage_id: stage.id,
                    assigned_to: null,
                    source: 'Importación Excel',
                    notes: `Importado de Excel - Ubicación: ${validated.LOCALIDAD || ''}, ${validated.PROVINCIA || ''}`.trim()
                })
            } catch (err: any) {
                console.error(`Error en fila ${i + 2}:`, err);
                let errorMsg = 'Datos inválidos';
                if (err instanceof z.ZodError) {
                    errorMsg = err.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', ');
                }
                errors.push({ row: i + 2, error: errorMsg })
            }
        }

        if (validLeads.length > 0) {
            const { error: insertError } = await supabase.from('leads').insert(validLeads)
            if (insertError) {
                console.error('Insert error:', insertError)
                return { success: false, error: 'Error al insertar los datos en la base de datos' }
            }
        }

        revalidatePath('/funnel')
        return {
            success: true,
            data: {
                imported: validLeads.length,
                failed: errors.length,
                errors
            }
        }

    } catch (error: any) {
        console.error('Import error:', error)
        return { success: false, error: error.message || 'Error desconocido' }
    }
}
