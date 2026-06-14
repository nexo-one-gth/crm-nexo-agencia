'use client'

import { Phone, MessageCircle, ChevronDown, MessageSquare, Edit, CheckCircle2, Clock, Users, ExternalLink, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { updateLeadStage, deleteLeads } from '@/app/actions/lead-actions'
import { calculateLeadCompletion, getCompletionColor } from '@/lib/utils/lead-completion'

import { toast } from 'sonner'

import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LeadCommentsModal } from '@/components/leads/LeadCommentsModal'
import { LeadEditModal } from '@/components/leads/LeadEditModal'
import { AlertDialog } from '@/components/ui/AlertDialog'

interface LeadCardProps {
    compact?: boolean
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
        // Alerta de documentación
        documentacion_pendiente?: string
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

// Etapas del embudo de medicina prepaga
const PIPELINE_STAGES = [
    { key: 'Pendiente', label: 'Lead', color: 'bg-slate-400 dark:bg-slate-500' },
    { key: 'Contactado', label: 'Contactado', color: 'bg-blue-500' },
    { key: 'Interesado', label: 'Interesado', color: 'bg-purple-500' },
    { key: 'Cotizado', label: 'Cotizado', color: 'bg-amber-500' },
    { key: 'Alta en Proceso', label: 'Alta', color: 'bg-emerald-500' },
    { key: 'Ganado', label: 'Ganado', color: 'bg-green-500' },
] as const

const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return null
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

export const LeadCard = ({ lead, isSelected, onSelect, isAdmin, userProfile, compact = false }: LeadCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
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

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsDeleteAlertOpen(true)
    }

    const handleDeleteConfirm = async () => {
        const result = await deleteLeads([lead.id])
        if (result.success) {
            toast.success('Lead eliminado correctamente')
            router.refresh()
        } else {
            toast.error('Error al eliminar lead: ' + result.error)
        }
    }

    const completion = calculateLeadCompletion(lead)
    const completionStyle = getCompletionColor(completion)

    const getStageStyle = (stage: string) => {
        switch (stage) {
            case 'Pendiente':
            case 'Pendiente de Asignación':
                return 'from-blue-600 to-blue-400'
            case 'Contactado':
                return 'from-amber-500 to-yellow-400'
            case 'Interesado':
                return 'from-indigo-600 to-blue-500'
            case 'Cotizado':
                return 'from-orange-600 to-orange-400'
            case 'Alta en Proceso':
                return 'from-purple-600 to-pink-500'
            case 'Ganado':
                return 'from-green-600 to-emerald-400'
            case 'No Interesado':
                return 'from-slate-600 to-slate-400'
            default:
                return 'from-slate-600 to-slate-400'
        }
    }

    const getUrgencySignal = (created_at: string) => {
        const days = Math.floor((Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24))
        if (days === 0) return { text: 'Ingresó hoy', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
        if (days === 1) return { text: 'Sin contacto: 1 día', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' }
        if (days <= 3) return { text: `Sin contacto: ${days} días`, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' }
        return { text: `Sin contacto: ${days} días`, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' }
    }

    return (
        <>
            <div
                onClick={() => onSelect && onSelect(lead.id)}
                className={`glass-card overflow-hidden rounded-2xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group shadow-sm flex bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 ${onSelect ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-blue-500/50' : ''}`}
            >
                {/* === BANDA DE COLOR LATERAL === */}
                <div className={`w-1.5 shrink-0 bg-gradient-to-b ${getStageStyle(lead.stage_name)} opacity-80`} />

                {/* === CONTENIDO PRINCIPAL COMPACTO === */}
                <div className={`flex-1 flex flex-col gap-2 min-w-0 ${compact ? 'p-2' : 'p-2.5'}`}>

                    {/* Fila 1: Header denso */}
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col min-w-0 pr-2">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100 truncate" title={`${lead.first_name} ${lead.last_name !== '.' ? lead.last_name : ''}`}>
                                    {lead.first_name} {lead.last_name !== '.' ? lead.last_name : ''}
                                </h4>
                                {lead.cantidad_integrantes && lead.cantidad_integrantes > 1 && (
                                    <div className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[9px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0 px-1">
                                        <Users className="w-2.5 h-2.5" />
                                        {lead.cantidad_integrantes}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="font-medium truncate">{lead.edades ? `Edades: ${lead.edades}` : 'Sin edades'}</span>
                                <span>•</span>
                                <span className="shrink-0 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: es }).replace('hace ', '')}
                                </span>
                            </div>
                        </div>

                        {/* Controles top-right */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsEditOpen(true)
                                }}
                                className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400"
                                title="Editar"
                            >
                                <Edit className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={handleDelete}
                                    className="w-6 h-6 rounded-md hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center transition-all text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {onSelect && (
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-50 border-blue-500/30' : 'border-slate-200 dark:border-white/10'}`}>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: Badges (Interés, Origen, Asesor) — ocultos en vista compacta */}
                    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'hidden' : ''}`}>
                        <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 flex items-center gap-1 max-w-[120px] truncate">
                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${getStageStyle(lead.stage_name)}`} />
                            <span className="truncate">{lead.plan || 'Sin especificar'}</span>
                            {interestLevel > 0 && <span className={`${FLAME_COLORS[interestLevel]} text-[10px]`}>🔥</span>}
                        </div>

                        <div className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-white/5 truncate max-w-[90px]">
                            {lead.source || 'Ads'}
                        </div>

                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border truncate max-w-[90px] ${lead.assigned_to_name === 'No asignado' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5'}`}>
                            {lead.assigned_to_name || 'Sin asignar'}
                        </div>
                    </div>

                    {/* Fila 3: Avance de etapa */}
                    {(() => {
                        const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.stage_name)
                        const nextStage = currentIdx >= 0 && currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null
                        return (
                            <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-slate-100 dark:border-white/5" ref={discardRef}>
                                {nextStage && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStageUpdate(nextStage.key) }}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm ${nextStage.color}`}
                                        title={`Avanzar a ${nextStage.label}`}
                                    >
                                        <ChevronDown className="w-3 h-3 -rotate-90" />
                                        {nextStage.label}
                                    </button>
                                )}
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsDiscardOpen(prev => !prev) }}
                                        className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"
                                        title="No interesado"
                                    >
                                        ✕
                                    </button>
                                    {isDiscardOpen && (
                                        <div className="absolute bottom-full right-0 mb-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2 pb-1">Motivo de descarte</p>
                                            {DISCARD_REASONS.map(reason => (
                                                <button
                                                    key={reason}
                                                    onClick={(e) => { e.stopPropagation(); handleDiscard(reason) }}
                                                    className="w-full text-left px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                                >
                                                    {reason}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    {/* Fila 4: Urgencia + Controles */}
                    {(() => {
                        const urgency = getUrgencySignal(lead.created_at)
                        return (
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
                                        className="w-5 h-5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                                        title={isExpanded ? 'Colapsar' : 'Ver más'}
                                    >
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgency.color}`}>
                                        {urgency.text}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Mini Score */}
                                    <div className="relative w-6 h-6 mr-1" title={`Completado: ${completion}%`}>
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-slate-100 dark:text-white/5" />
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="transparent" strokeDasharray={2 * Math.PI * 10} strokeDashoffset={2 * Math.PI * 10 * (1 - completion / 100)} className={`${completionStyle.split(' ')[0]} transition-all duration-1000`} />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className={`text-[8px] font-black ${completionStyle.split(' ')[0]}`}>{completion}</span>
                                        </div>
                                    </div>
                                    <a
                                        href={`tel:${lead.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95"
                                        title={`Llamar a ${lead.phone}`}
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                    </a>
                                    <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(e) }} className="w-7 h-7 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-all shadow-sm active:scale-95" title="Enviar WhatsApp">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <Link href={`/leads/${lead.id}`} target="_blank" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all" onClick={(e) => e.stopPropagation()} title="Vista Completa">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )
                    })()}

                    {/* === CONTENIDO EXPANDIDO === */}
                    {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-1 text-[10px]">
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Teléfono</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{lead.phone}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">En Pipeline</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: es })}
                                    </p>
                                </div>
                                {lead.obra_social && (
                                    <div className="space-y-0.5">
                                        <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Obra Social</span>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{lead.obra_social}</p>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Fecha Ingreso</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{new Date(lead.created_at).toLocaleDateString('es-AR')}</p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true) }}
                                className="w-full mt-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                                <MessageSquare className="w-3 h-3" /> Ver Historial
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Expanded Content (Renderizados fuera del div transformado para evitar recortes de overflow-hidden) */}
            <WhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                lead={lead}
                userName={userProfile?.full_name || undefined}
            />

            {isEditOpen && (
                <LeadEditModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    lead={lead}
                />
            )}

            {isCommentsOpen && (
                <LeadCommentsModal
                    isOpen={isCommentsOpen}
                    onClose={() => setIsCommentsOpen(false)}
                    leadId={lead.id}
                    leadName={`${lead.first_name} ${lead.last_name}`}
                />
            )}

            <AlertDialog
                isOpen={isDeleteAlertOpen}
                onClose={() => setIsDeleteAlertOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Eliminar lead"
                description={`¿Seguro que querés eliminar a ${lead.first_name}? Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
            />
        </>
    )
}
