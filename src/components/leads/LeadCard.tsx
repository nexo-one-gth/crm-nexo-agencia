'use client'

import { Phone, User, MessageCircle, Calendar, ChevronDown, MessageSquare, DollarSign, Flame, FileText, MapPin, Mail, CreditCard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logWhatsAppActivity, updateLeadStage } from '@/app/actions/lead-actions'

import { toast } from 'sonner'

import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LeadCommentsModal } from '@/components/leads/LeadCommentsModal'

interface LeadCardProps {
    lead: {
        id: string
        first_name: string
        last_name: string
        phone: string
        email?: string
        dni?: string
        address_state?: string
        address_city?: string
        obra_social?: string
        cantidad_integrantes?: number
        notes?: string
        created_at: string
        stage_name: string
        assigned_to_name?: string
        discard_reason?: string
        // Nuevos campos migración crm-lh
        numero_tramite?: string
        edades?: string
        cuil?: string
        cuit_empleador?: string
        plan?: string
        valor_plan?: number
        descuento_aportes?: number
        descuento_comercial?: number
        iva?: number
        valor_final_socio?: number
        valor_forecast?: number
        observaciones_cotizacion?: string
        interest_level?: number
        source?: string
    }
    isSelected?: boolean
    onSelect?: (id: string) => void
    isAdmin?: boolean
    userProfile?: {
        full_name: string | null
        whatsapp_name: string | null
    } | null
}

const DISCARD_REASONS = [
    'No responde',
    'Preexistencia',
    'Embarazo en curso',
    'Rango de edad incorrecto',
    'Solo consulta',
]

const FLAME_COLORS = ['text-slate-400', 'text-yellow-500', 'text-orange-500']

const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return null
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

export const LeadCard = ({ lead, isSelected, onSelect, isAdmin, userProfile }: LeadCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    const discardRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const hasQuoteData = lead.plan || lead.valor_final_socio || lead.valor_forecast
    const interestLevel = lead.interest_level ?? 0

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (discardRef.current && !discardRef.current.contains(event.target as Node)) {
                setIsDiscardOpen(false)
            }
        }
        if (isDiscardOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isDiscardOpen])

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsWhatsAppModalOpen(true)
    }

    const handleStageUpdate = async (newStageName: string, discardReason?: string) => {
        const result = await updateLeadStage(lead.id, newStageName, discardReason)
        if (result.success) {
            const msg = discardReason
                ? `Descartado: ${discardReason}`
                : `Etapa actualizada a ${newStageName}`
            toast.success(msg)
            router.refresh()
        } else {
            toast.error('Error al actualizar la etapa: ' + result.error)
        }
    }

    const handleDiscard = (reason: string) => {
        setIsDiscardOpen(false)
        handleStageUpdate('No Interesado', reason)
    }

    return (
        <div
            onClick={() => onSelect ? onSelect(lead.id) : setIsExpanded(!isExpanded)}
            className={`glass-card p-3 sm:p-4 rounded-xl cursor-pointer hover:bg-white/15 transition-all duration-300 group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                }`}
        >
            {/* === HEADER COMPACTO (siempre visible) === */}
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {onSelect && (
                            <div className={`shrink-0 w-5 h-5 sm:w-4 sm:h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-white/20'
                                }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        )}
                        <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm sm:text-base">
                            {lead.first_name} {lead.last_name}
                        </h4>
                        {/* Indicador de interés */}
                        {interestLevel > 0 && (
                            <span className={`${FLAME_COLORS[interestLevel]} text-sm`} title={`Interés: ${interestLevel === 1 ? 'Medio' : 'Alto'}`}>
                                🔥
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {lead.phone}
                        </p>
                        {lead.dni && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span className="font-bold">DNI:</span> {lead.dni}
                            </p>
                        )}
                        {lead.email && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[150px]">
                                {lead.email}
                            </p>
                        )}
                        {(lead.address_city || lead.address_state) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 italic">
                                {lead.address_city && <span>{lead.address_city}</span>}
                                {lead.address_city && lead.address_state && <span>, </span>}
                                {lead.address_state && <span>{lead.address_state}</span>}
                            </p>
                        )}
                        {/* Badge de forecast si existe */}
                        {lead.valor_forecast && lead.valor_forecast > 0 && (
                            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                                FC {formatCurrency(lead.valor_forecast)}
                            </span>
                        )}
                    </div>

                    {lead.stage_name === 'No Interesado' && lead.discard_reason && (
                        <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 w-fit">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                Motivo: {lead.discard_reason}
                            </span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 w-fit">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                Asesor: {lead.assigned_to_name || 'Sin Asignar'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Botones de acción rápida */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleWhatsApp}
                        className="p-2.5 sm:p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 hover:border-green-500/50 transition-all shrink-0 active:scale-90"
                        title="WhatsApp"
                    >
                        <MessageCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            <WhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                lead={lead}
                userName={userProfile?.full_name || undefined}
            />

            {/* === CONTENIDO EXPANDIDO === */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-4 animate-in slide-in-from-top-2 duration-300">

                    {/* Fila Informativa (Solo campos que NO están en el header) */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        {lead.obra_social && (
                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">Obra Social</span>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{lead.obra_social}</p>
                            </div>
                        )}
                        <div className="space-y-1">
                            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">Fecha Ingreso</span>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{new Date(lead.created_at).toLocaleDateString('es-AR')}</p>
                        </div>

                        {lead.numero_tramite && (
                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">Nro Trámite</span>
                                <p className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">{lead.numero_tramite}</p>
                            </div>
                        )}

                        {lead.cantidad_integrantes && lead.cantidad_integrantes > 0 && (
                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">Grupo Familiar</span>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">
                                    {lead.cantidad_integrantes} {lead.cantidad_integrantes === 1 ? 'persona' : 'personas'}
                                    {lead.edades && <span className="text-slate-400 font-normal block text-[10px]">Edades: {lead.edades}</span>}
                                </p>
                            </div>
                        )}

                        {lead.cuil && (
                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">CUIL Titular</span>
                                <p className="font-mono text-[11px] text-slate-700 dark:text-slate-200">{lead.cuil}</p>
                            </div>
                        )}

                        {lead.cuit_empleador && (
                            <div className="space-y-1">
                                <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px]">CUIT Empleador</span>
                                <p className="font-mono text-[11px] text-slate-700 dark:text-slate-200">{lead.cuit_empleador}</p>
                            </div>
                        )}
                    </div>

                    {/* Sección: Cotización (Premium Glassmorphism) */}
                    {hasQuoteData && (
                        <div className="relative overflow-hidden p-3.5 rounded-2xl bg-white/5 dark:bg-black/20 border border-white/10 shadow-inner">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <DollarSign className="w-12 h-12 text-emerald-500" />
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1 rounded-md bg-emerald-500/20">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Cotización Detallada</span>
                            </div>

                            <div className="space-y-2.5">
                                {lead.plan && (
                                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                        <span className="text-slate-500 text-[11px]">Plan Seleccionado</span>
                                        <span className="font-bold text-slate-800 dark:text-white text-xs">{lead.plan}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                                    {lead.valor_plan != null && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Valor Base:</span>
                                            <span className="font-medium">{formatCurrency(lead.valor_plan)}</span>
                                        </div>
                                    )}
                                    {lead.iva != null && lead.iva > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">IVA:</span>
                                            <span className="font-medium">{formatCurrency(lead.iva)}</span>
                                        </div>
                                    )}
                                    {lead.descuento_aportes != null && lead.descuento_aportes > 0 && (
                                        <div className="flex justify-between col-span-2 text-rose-500">
                                            <span>Bonificación Aportes:</span>
                                            <span className="font-bold">-{formatCurrency(lead.descuento_aportes)}</span>
                                        </div>
                                    )}
                                    {lead.descuento_comercial != null && lead.descuento_comercial > 0 && (
                                        <div className="flex justify-between col-span-2 text-rose-500">
                                            <span>Descuento Comercial:</span>
                                            <span className="font-bold">-{formatCurrency(lead.descuento_comercial)}</span>
                                        </div>
                                    )}
                                </div>

                                {lead.valor_final_socio != null && (
                                    <div className="mt-2 pt-2 border-t border-emerald-500/20 flex justify-between items-center">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase">Total Socio</span>
                                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                            {formatCurrency(lead.valor_final_socio)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {lead.observaciones_cotizacion && (
                                <div className="mt-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[10px] text-slate-500 italic">
                                    <FileText className="w-3 h-3 inline mr-1 mb-0.5" />
                                    {lead.observaciones_cotizacion}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Source & Notes */}
                    <div className="flex flex-col gap-2">
                        {lead.notes && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                "{lead.notes}"
                            </div>
                        )}
                        {lead.source && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 w-fit border border-slate-200 dark:border-white/10">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Origen: {lead.source}</span>
                            </div>
                        )}
                    </div>

                    {/* Botón Comentarios (Full Width) */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true) }}
                        className="w-full py-2.5 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 hover:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> Ver Comentarios e Historial
                    </button>

                    {/* Stage Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        {lead.stage_name === 'Pendiente' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStageUpdate('Contactado') }}
                                className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-blue-500/20"
                            >
                                Contactar
                            </button>
                        )}
                        {lead.stage_name === 'Contactado' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStageUpdate('Interesado') }}
                                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-purple-500/20"
                            >
                                Marcar Interesado
                            </button>
                        )}
                        {(lead.stage_name === 'Pendiente' || lead.stage_name === 'Contactado' || lead.stage_name === 'Interesado') && (
                            <div ref={discardRef} className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsDiscardOpen(!isDiscardOpen) }}
                                    className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-slate-300 dark:hover:bg-white/15 transition-all active:scale-95"
                                >
                                    Descartar <ChevronDown className={`w-3 h-3 transition-transform ${isDiscardOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isDiscardOpen && (
                                    <div className="absolute bottom-full mb-2 left-0 right-0 z-50 py-1.5 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-800/95 border border-white/40 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-3 py-1 mb-1 border-b border-black/5">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Motivo de descarte</span>
                                        </div>
                                        {DISCARD_REASONS.map((reason) => (
                                            <button
                                                key={reason}
                                                onClick={(e) => { e.stopPropagation(); handleDiscard(reason) }}
                                                className="w-full text-left px-4 py-2 text-[11px] text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {lead.stage_name === 'Interesado' && (
                            <div className="text-center py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider border border-emerald-500/20 flex items-center justify-center gap-1">
                                <Flame className="w-3 h-3" /> Prioritarios
                            </div>
                        )}
                    </div>
                </div>
            )}

            <LeadCommentsModal
                isOpen={isCommentsOpen}
                onClose={() => setIsCommentsOpen(false)}
                leadId={lead.id}
                leadName={`${lead.first_name} ${lead.last_name}`}
            />
        </div>
    )
}
