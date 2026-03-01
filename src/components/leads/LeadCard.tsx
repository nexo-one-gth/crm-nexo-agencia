'use client'

import { Phone, User, MessageCircle, Calendar, ChevronDown, MessageSquare, DollarSign, Flame, FileText, MapPin, Mail, CreditCard, Edit, CheckCircle2, Clock, Users, ExternalLink } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { logWhatsAppActivity, updateLeadStage } from '@/app/actions/lead-actions'
import { calculateLeadCompletion, getCompletionColor } from '@/lib/utils/lead-completion'

import { toast } from 'sonner'

import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LeadCommentsModal } from '@/components/leads/LeadCommentsModal'
import { LeadEditModal } from '@/components/leads/LeadEditModal'

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

export const LeadCard = ({ lead, isSelected, onSelect, isAdmin, userProfile }: LeadCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
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

    const getNextAction = (stage: string) => {
        switch (stage) {
            case 'Pendiente': return { title: 'Primer contacto telefónico', subtitle: 'Hoy antes de las 14hs · Llamada' }
            case 'Contactado': return { title: 'Preparar y enviar cotización', subtitle: 'Hoy · Email + WhatsApp' }
            case 'Interesado': return { title: 'Seguimiento por WhatsApp', subtitle: 'Revisar si pudo ver la cotización' }
            case 'Cotizado': return { title: 'Solicitar documentación', subtitle: 'Pendiente: DNI titular y cónyuge' }
            default: return { title: 'Seguimiento de rutina', subtitle: 'Mantener contacto con el prospecto' }
        }
    }

    const nextAction = getNextAction(lead.stage_name)

    return (
        <>
            <div
                onClick={() => onSelect ? onSelect(lead.id) : setIsExpanded(!isExpanded)}
                className={`glass-card overflow-hidden rounded-3xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 group border-white/20 shadow-xl ${isSelected ? 'ring-4 ring-blue-500/50' : ''}`}
            >
                {/* === HEADER CON GRADIENTE (SCREEN STYLE) === */}
                <div className={`p-5 bg-gradient-to-br ${getStageStyle(lead.stage_name)} text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />

                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 ">
                                <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{lead.stage_name}</span>
                                </div>
                                {lead.assigned_to_name === 'No asignado' && (
                                    <div className="text-[9px] font-bold opacity-70 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full border border-white" />
                                        Sin asignar
                                    </div>
                                )}
                            </div>

                            <h4 className="text-2xl font-black tracking-tighter mt-1 truncate max-w-full" title={`${lead.first_name} ${lead.last_name !== '.' ? lead.last_name : ''}`}>
                                {lead.first_name} {lead.last_name !== '.' ? lead.last_name : ''}
                            </h4>
                            <p className="text-[11px] font-medium opacity-90 truncate">
                                {lead.edades ? `Edades: ${lead.edades}` : 'Sin edades registradas'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 relative z-10 transition-opacity duration-300">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsEditOpen(true)
                                }}
                                className="shrink-0 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-all border border-white/20 shadow-sm opacity-0 group-hover:opacity-100"
                                title="Editar Lead rápidamente"
                            >
                                <Edit className="w-4 h-4 text-white" />
                            </button>
                            {onSelect && (
                                <div className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-white/40'}`}>
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                        <div className="px-2 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            <span className="text-[10px] font-bold">{lead.cantidad_integrantes || 1} integrantes</span>
                        </div>
                        {(lead.address_city || lead.address_state) && (
                            <div className="px-2 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] font-bold truncate max-w-[80px]">{lead.address_city || lead.address_state}</span>
                            </div>
                        )}
                        <div className="px-2 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold">Ingresó: {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: es })}</span>
                        </div>
                    </div>
                </div>

                {/* === CUERPO DE LA TARJETA === */}
                <div className="p-5 space-y-5 bg-white dark:bg-slate-900/50">

                    {/* Score & Interest */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Interés declarado</span>
                            <div className="flex items-center gap-2">
                                <p className="text-lg font-black tracking-tight text-slate-800 dark:text-white leading-none">
                                    {lead.plan || 'Plan Familiar'}
                                </p>
                                {interestLevel > 0 && (
                                    <span className={`${FLAME_COLORS[interestLevel]} text-sm animate-bounce`}>🔥</span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500">{lead.observaciones_cotizacion ? 'Cotización enviada' : 'Sin cotización aún'}</p>
                        </div>

                        {/* Circular Score */}
                        <div className="relative w-14 h-14">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="28"
                                    cy="28"
                                    r="24"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="transparent"
                                    className="text-slate-100 dark:text-white/5"
                                />
                                <circle
                                    cx="28"
                                    cy="28"
                                    r="24"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="transparent"
                                    strokeDasharray={2 * Math.PI * 24}
                                    strokeDashoffset={2 * Math.PI * 24 * (1 - completion / 100)}
                                    className={`${completionStyle.split(' ')[0]} transition-all duration-1000`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xs font-black ${completionStyle.split(' ')[0]}`}>{completion}</span>
                                <span className="text-[6px] font-black uppercase opacity-40">Score</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid Info */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-100 dark:border-white/5 pt-5">
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Origen</span>
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{lead.source || 'Instagram Ads'}</p>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Asesor</span>
                            <p className={`text-[11px] font-bold truncate ${lead.assigned_to_name === 'No asignado' ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {lead.assigned_to_name || 'Sin asignar'}
                            </p>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Teléfono</span>
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{lead.phone}</p>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">En Pipeline</span>
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">2 horas</p>
                        </div>
                    </div>

                    {/* Next Action Box */}
                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3 group/action">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 transition-colors group-hover/action:bg-blue-600 group-hover/action:text-white">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Próxima Acción</span>
                            <p className="text-xs font-black text-slate-800 dark:text-white truncate">{nextAction.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">{nextAction.subtitle}</p>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            onClick={handleWhatsApp}
                            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            Asignar asesor
                        </button>

                        <Link
                            href={`/leads/${lead.id}`}
                            target="_blank"
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-white/5 transition-all"
                            onClick={(e) => e.stopPropagation()}
                            title="Abrir Vista Detallada"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </Link>
                    </div>

                    {/* === CONTENIDO EXPANDIDO === */}
                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
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
                            </div>

                            {/* Botón Comentarios */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true) }}
                                className="w-full py-2.5 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 hover:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                            >
                                <MessageSquare className="w-3.5 h-3.5" /> Ver Comentarios e Historial
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
        </>
    )
}
