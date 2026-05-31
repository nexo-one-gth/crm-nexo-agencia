'use server'

import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '@/lib/supabase/assert-admin'
import type { TablesInsert } from '@/lib/supabase/types'
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

        const guard = await assertAdmin()
        if (guard.error) return { success: false, error: guard.error }

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
        const validRows: { rowIndex: number, data: TablesInsert<'leads'> }[] = []
        let importedCount = 0

        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

        const SYNONYMS: Record<string, string[]> = {
            CELULAR: ['TELEFONO', 'TEL', 'CEL', 'MOBILE', 'WHATSAPP', 'CELLULAR', 'CONTATO'],
            MAIL: ['EMAIL', 'CORREO', 'CONTACTO', 'E-MAIL', 'MAIL'],
            PROVINCIA: ['ESTADO', 'STATE', 'REGION', 'PROV'],
            LOCALIDAD: ['CIUDAD', 'CITY', 'PUEBLO', 'LOCAL', 'LOC'],
            NOMBRE: ['NAME', 'NOMBRE COMPLETO', 'APELLIDO Y NOMBRE', 'NOMBRE Y APELLIDO'],
            DNI: ['DOCUMENTO', 'ID', 'DOC'],
            OBRA_SOCIAL: ['PREPAGA', 'COBERTURA', 'OS', 'OBRA SOCIAL'],
            OBSERVACIONES: ['NOTAS', 'NOTES', 'COMENTARIOS', 'OBS']
        };

        const normalizedData = rawData.map(row => {
            const normalized: Record<string, unknown> = {};
            const rowObj = row as Record<string, unknown>;

            // Map row keys to our expected normalized keys using synonyms
            Object.keys(SYNONYMS).forEach(targetKey => {
                const synonyms = SYNONYMS[targetKey];
                const sourceKey = Object.keys(rowObj).find(k => {
                    const normK = normalize(k);
                    return normK === targetKey || synonyms.includes(normK);
                });

                if (sourceKey) {
                    normalized[targetKey] = rowObj[sourceKey];
                }
            });

            // Keep other keys that don't have synonyms but might match exactly (case-insensitive)
            Object.keys(rowObj).forEach(key => {
                const upperKey = normalize(key).replace(/\s+/g, '_');
                if (!normalized[upperKey]) {
                    normalized[upperKey] = rowObj[key];
                }
            });

            return normalized;
        });

        for (let i = 0; i < normalizedData.length; i++) {
            const row = normalizedData[i];

            // Intelligent Field Detection: Agresivamente detectamos si los datos están cruzados
            let email = String(row.MAIL || '').trim();
            let phone = String(row.CELULAR || '').trim();
            let province = String(row.PROVINCIA || '').trim();
            let city = String(row.LOCALIDAD || '').trim();

            const isPhoneFormat = (s: string) => s.replace(/^'/, '').trim().match(/^['+]?[\d\s-]{7,}$/);
            const isEmailFormat = (s: string) => s.includes('@');

            // 1. Swap PROVINCIA <-> CELULAR if formats are crossed
            if (isPhoneFormat(province) && !isPhoneFormat(phone)) {
                const temp = phone;
                phone = province;
                province = temp;
            }

            // 2. Swap LOCALIDAD <-> MAIL if formats are crossed
            if (isEmailFormat(city) && !isEmailFormat(email)) {
                const temp = email;
                email = city;
                city = temp;
            }

            // Update row with corrected values for Zod validation
            row.CELULAR = phone.replace(/^'/, '').trim();
            row.MAIL = email.replace(/^'/, '').trim();
            row.PROVINCIA = province.replace(/^'/, '').trim();
            row.LOCALIDAD = city.replace(/^'/, '').trim();

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

            validRows.push({
                rowIndex: i + 2,
                data: {
                    first_name: firstName as string,
                    last_name: lastName,
                    phone: validated.CELULAR,
                    email: validated.MAIL || null,
                    dni: validated.DNI && validated.DNI.trim() !== '' ? validated.DNI.trim() : null,
                    address_state: validated.PROVINCIA || null,
                    address_city: validated.LOCALIDAD || null,
                    pipeline_stage_id: stage.id,
                    assigned_to: null,
                    notes: (validated.OBSERVACIONES || `Importado de Excel - Ubicación: ${validated.LOCALIDAD || ''}, ${validated.PROVINCIA || ''} - Origen original: ${validated.ORIGEN_DATO || 'Importación Excel'}`).trim(),
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
                }
            })
        }

        // Batch insert en lotes de 100 para manejar duplicados por lote
        const BATCH_SIZE = 100
        for (let b = 0; b < validRows.length; b += BATCH_SIZE) {
            const batch = validRows.slice(b, b + BATCH_SIZE)
            const { error: batchError } = await supabase
                .from('leads')
                .insert(batch.map(r => r.data))

            if (!batchError) {
                importedCount += batch.length
                continue
            }

            // Si el lote falla (ej. duplicado), cae a inserción individual para identificar la fila exacta
            for (const row of batch) {
                const { error: insertError } = await supabase.from('leads').insert(row.data)
                if (insertError) {
                    let errorMsg = 'Error al insertar en la base de datos'
                    if (insertError.code === '23505') {
                        if (insertError.message.includes('dni')) {
                            errorMsg = `DNI duplicado: ${row.data.dni}`
                        } else if (insertError.message.includes('phone')) {
                            errorMsg = `Teléfono duplicado: ${row.data.phone}`
                        } else {
                            errorMsg = 'Registro duplicado (ya existe en la base de datos)'
                        }
                    }
                    errors.push({ row: row.rowIndex, error: errorMsg })
                } else {
                    importedCount++
                }
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
