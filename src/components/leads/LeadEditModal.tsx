'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { updateLead } from '@/app/actions/lead-actions'
import { toast } from 'sonner'
import { X, User, Phone, Mail, CreditCard, MapPin, Briefcase, DollarSign, FileText, Users, Activity, Tag, CheckCircle2, ChevronDown } from 'lucide-react'
import { calculateLeadCompletion, getCompletionColor, COMPLETION_FIELDS } from '@/lib/utils/lead-completion'

// ── Zod schema — todos los campos son opcionales salvo id ──────────────────────
const leadUpdateSchema = z.object({
    id: z.string(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().optional().or(z.literal('')).refine(
        val => !val || val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        { message: 'Email inválido' }
    ),
    dni: z.string().optional(),
    cuil: z.string().optional(),
    cuit_empleador: z.string().optional(),
    numero_tramite: z.string().optional(),
    address_state: z.string().optional(),
    address_city: z.string().optional(),
    obra_social: z.string().optional(),
    cantidad_integrantes: z.coerce.number().int().optional(),
    edades: z.string().optional(),
    plan: z.string().optional(),
    valor_plan: z.coerce.number().optional(),
    iva: z.coerce.number().optional(),
    descuento_aportes: z.coerce.number().optional(),
    descuento_comercial: z.coerce.number().optional(),
    valor_final_socio: z.coerce.number().optional(),
    valor_forecast: z.coerce.number().optional(),
    observaciones_cotizacion: z.string().optional(),
    interest_level: z.coerce.number().int().min(0).max(2).optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    documentacion_pendiente: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadUpdateSchema>

interface LeadEditModalProps {
    isOpen: boolean
    onClose: () => void
    lead: Record<string, unknown>
}

// ── Componente auxiliar para cada fila del formulario ─────────────────────────
const Field = ({
    label,
    name,
    value,
    onChange,
    type = 'text',
    colSpan = 1,
    icon,
    textarea = false,
    isMissing = false,
}: {
    label: string
    name: string
    value: string | number | undefined
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    type?: string
    colSpan?: 1 | 2
    icon?: React.ReactNode
    textarea?: boolean
    isMissing?: boolean
}) => (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
        <div className="flex justify-between items-center mb-1.5 px-1">
            <label className={`text-[10px] uppercase font-black tracking-widest ${isMissing ? 'text-amber-500' : 'text-slate-400'}`}>
                {label}
            </label>
            {isMissing && (
                <span className="text-[9px] font-black text-amber-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Sin completar
                </span>
            )}
        </div>
        <div className="relative">
            {icon && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    {icon}
                </span>
            )}
            {textarea ? (
                <textarea
                    name={name}
                    value={value ?? ''}
                    onChange={onChange}
                    rows={3}
                    className={`w-full rounded-xl bg-[#F4F4F2] dark:bg-slate-800/50 border ${isMissing ? 'border-amber-200 bg-amber-50/30' : 'border-white/60'} text-slate-800 dark:text-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-400 resize-none shadow-sm transition-all ${icon ? 'pl-9' : ''}`}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value ?? ''}
                    onChange={onChange}
                    className={`w-full rounded-xl bg-[#F4F4F2] dark:bg-slate-800/50 border ${isMissing ? 'border-amber-200 bg-amber-50/30' : 'border-white/60'} text-slate-800 dark:text-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-400 shadow-sm transition-all ${icon ? 'pl-9' : ''}`}
                />
            )}
        </div>
    </div>
)

// ── Componente Accordion para secciones ───────────────────────────────────────
const AccordionSection = ({ title, icon, children, defaultOpen = false }: { title: string, icon?: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    return (
        <div className="bg-[#F8F8F6]/60 dark:bg-white/5 rounded-2xl border border-white/50 dark:border-white/10 overflow-hidden transition-all duration-300">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    {icon}
                    {title}
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 pt-0">
                    {children}
                </div>
            </div>
        </div>
    )
}

// ── Modal principal ────────────────────────────────────────────────────────────
export const LeadEditModal = ({ isOpen, onClose, lead }: LeadEditModalProps) => {
    const router = useRouter()
    const [formData, setFormData] = useState<LeadFormData>({
        id: lead.id as string,
        first_name: lead.first_name as string | undefined,
        last_name: lead.last_name as string | undefined,
        phone: lead.phone as string | undefined,
        email: lead.email as string | undefined,
        dni: lead.dni as string | undefined,
        cuil: lead.cuil as string | undefined,
        cuit_empleador: lead.cuit_empleador as string | undefined,
        numero_tramite: lead.numero_tramite as string | undefined,
        address_state: lead.address_state as string | undefined,
        address_city: lead.address_city as string | undefined,
        obra_social: lead.obra_social as string | undefined,
        cantidad_integrantes: lead.cantidad_integrantes as number | undefined,
        edades: lead.edades as string | undefined,
        plan: lead.plan as string | undefined,
        valor_plan: lead.valor_plan as number | undefined,
        iva: lead.iva as number | undefined,
        descuento_aportes: lead.descuento_aportes as number | undefined,
        descuento_comercial: lead.descuento_comercial as number | undefined,
        valor_final_socio: lead.valor_final_socio as number | undefined,
        valor_forecast: lead.valor_forecast as number | undefined,
        observaciones_cotizacion: lead.observaciones_cotizacion as string | undefined,
        interest_level: lead.interest_level as number | undefined,
        source: lead.source as string | undefined,
        notes: lead.notes as string | undefined,
        documentacion_pendiente: lead.documentacion_pendiente as string | undefined,
    })
    const [isSaving, setIsSaving] = useState(false)

    if (!isOpen) return null

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        // Convertir strings vacíos a undefined para que coerce.number() no los rechace
        const sanitized = {
            ...formData,
            valor_plan: formData.valor_plan === ('' as unknown) ? undefined : formData.valor_plan,
            descuento_aportes: formData.descuento_aportes === ('' as unknown) ? undefined : formData.descuento_aportes,
            descuento_comercial: formData.descuento_comercial === ('' as unknown) ? undefined : formData.descuento_comercial,
            valor_final_socio: formData.valor_final_socio === ('' as unknown) ? undefined : formData.valor_final_socio,
            valor_forecast: formData.valor_forecast === ('' as unknown) ? undefined : formData.valor_forecast,
        }
        const parseResult = leadUpdateSchema.safeParse(sanitized)
        if (!parseResult.success) {
            const campos = parseResult.error.issues.map(i => i.path.join('.')).join(', ')
            toast.error('Campo inválido: ' + campos)
            setIsSaving(false)
            return
        }
        const result = await updateLead(parseResult.data)
        setIsSaving(false)
        if (result.success) {
            toast.success('Lead actualizado correctamente ✅')
            router.refresh()
            onClose()
        } else {
            toast.error('Error al actualizar: ' + result.error)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-[#EBEAE5] dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200 hide-scrollbar flex flex-col">

                {/* ── Header ── */}
                <div className="sticky top-0 z-20 p-0 bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/10 rounded-t-[2rem]">
                    <div className="flex items-center justify-between px-6 py-5">
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Editar Lead</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">{formData.first_name} {formData.last_name !== '.' ? formData.last_name : ''}</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <CheckCircle2 className={`w-4 h-4 ${getCompletionColor(calculateLeadCompletion(formData)).split(' ')[0]}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${getCompletionColor(calculateLeadCompletion(formData)).split(' ')[0]}`}>
                                        {calculateLeadCompletion(formData)}% Completo
                                    </span>
                                </div>
                                <div className="w-32 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${calculateLeadCompletion(formData) === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${calculateLeadCompletion(formData)}%` }}
                                    />
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* ── Sección: Datos personales ── */}
                    <AccordionSection title="Datos Personales" icon={<User className="w-4 h-4 text-blue-500" />} defaultOpen={true}>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Nombre" name="first_name" value={formData.first_name} onChange={handleChange} icon={<User className="w-3.5 h-3.5" />} isMissing={!formData.first_name} />
                            <Field label="Apellido" name="last_name" value={formData.last_name} onChange={handleChange} icon={<User className="w-3.5 h-3.5" />} isMissing={!formData.last_name} />
                            <Field label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} icon={<Phone className="w-3.5 h-3.5" />} type="tel" isMissing={!formData.phone} />
                            <Field label="Email" name="email" value={formData.email} onChange={handleChange} icon={<Mail className="w-3.5 h-3.5" />} type="email" isMissing={!formData.email} />
                            <Field label="DNI" name="dni" value={formData.dni} onChange={handleChange} icon={<CreditCard className="w-3.5 h-3.5" />} isMissing={!formData.dni} />
                            <Field label="CUIL Titular" name="cuil" value={formData.cuil} onChange={handleChange} icon={<CreditCard className="w-3.5 h-3.5" />} isMissing={!formData.cuil} />
                            <Field label="CUIT Empleador" name="cuit_empleador" value={formData.cuit_empleador} onChange={handleChange} icon={<Briefcase className="w-3.5 h-3.5" />} isMissing={!formData.cuit_empleador} />
                            <Field label="Nro. Trámite" name="numero_tramite" value={formData.numero_tramite} onChange={handleChange} icon={<FileText className="w-3.5 h-3.5" />} isMissing={!formData.numero_tramite} />
                        </div>
                    </AccordionSection>

                    {/* ── Sección: Origen e Información de Seguimiento ── */}
                    <AccordionSection title="Datos de Origen y Seguimiento" icon={<Tag className="w-4 h-4 text-orange-500" />}>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Nivel de Interés</label>
                                </div>
                                <select
                                    name="interest_level"
                                    value={formData.interest_level ?? 0}
                                    onChange={(e) => setFormData(prev => ({ ...prev, interest_level: Number(e.target.value) }))}
                                    className="w-full rounded-xl bg-[#F4F4F2] dark:bg-slate-800/50 border border-white/60 text-slate-800 dark:text-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all"
                                >
                                    <option value={0}>Sin definir</option>
                                    <option value={1}>🔥 Medio</option>
                                    <option value={2}>🔥🔥 Alto</option>
                                </select>
                            </div>
                            <Field
                                label="Origen (Source)"
                                name="source"
                                value={formData.source}
                                onChange={handleChange}
                                icon={<Tag className="w-3.5 h-3.5" />}
                            />
                            <Field
                                label="Documentación Pendiente"
                                name="documentacion_pendiente"
                                value={formData.documentacion_pendiente}
                                onChange={handleChange}
                                colSpan={2}
                                icon={<FileText className="w-3.5 h-3.5" />}
                            />
                            <Field
                                label="Notas internas"
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                textarea
                                colSpan={2}
                            />
                        </div>
                    </AccordionSection>

                    {/* ── Sección: Ubicación & Cobertura ── */}
                    <AccordionSection title="Información Adicional (Ubicación y Cobertura)" icon={<MapPin className="w-4 h-4 text-purple-500" />}>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Provincia" name="address_state" value={formData.address_state} onChange={handleChange} icon={<MapPin className="w-3.5 h-3.5" />} isMissing={!formData.address_state} />
                            <Field label="Ciudad" name="address_city" value={formData.address_city} onChange={handleChange} icon={<MapPin className="w-3.5 h-3.5" />} isMissing={!formData.address_city} />
                            <Field label="Obra Social Actual" name="obra_social" value={formData.obra_social} onChange={handleChange} icon={<Activity className="w-3.5 h-3.5" />} isMissing={!formData.obra_social} />
                            <Field label="Cantidad de integrantes" name="cantidad_integrantes" value={formData.cantidad_integrantes} onChange={handleChange} type="number" icon={<Users className="w-3.5 h-3.5" />} isMissing={!formData.cantidad_integrantes} />
                            <Field label="Edades (ej: 35, 30, 5)" name="edades" value={formData.edades} onChange={handleChange} colSpan={2} isMissing={!formData.edades} />
                        </div>
                    </AccordionSection>

                    {/* ── Sección: Cotización ── */}
                    <AccordionSection title="Información de Cotización" icon={<DollarSign className="w-4 h-4 text-emerald-500" />}>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Plan" name="plan" value={formData.plan} onChange={handleChange} colSpan={2} isMissing={!formData.plan} />
                            <Field label="Valor Base (ARS)" name="valor_plan" value={formData.valor_plan} onChange={handleChange} type="number" icon={<DollarSign className="w-3.5 h-3.5" />} isMissing={!formData.valor_plan} />
                            <Field label="IVA (ARS)" name="iva" value={formData.iva} onChange={handleChange} type="number" icon={<DollarSign className="w-3.5 h-3.5" />} />
                            <Field label="Desc. Aportes (ARS)" name="descuento_aportes" value={formData.descuento_aportes} onChange={handleChange} type="number" />
                            <Field label="Desc. Comercial (ARS)" name="descuento_comercial" value={formData.descuento_comercial} onChange={handleChange} type="number" />
                            <Field label="Total Socio (ARS)" name="valor_final_socio" value={formData.valor_final_socio} onChange={handleChange} type="number" icon={<DollarSign className="w-3.5 h-3.5" />} isMissing={!formData.valor_final_socio} />
                            <Field label="Forecast (ARS)" name="valor_forecast" value={formData.valor_forecast} onChange={handleChange} type="number" isMissing={!formData.valor_forecast} />
                            <Field label="Observaciones cotización" name="observaciones_cotizacion" value={formData.observaciones_cotizacion} onChange={handleChange} textarea colSpan={2} />
                        </div>
                    </AccordionSection>

                    {/* ── Acciones ── */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2.5 rounded-2xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                            {isSaving ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
